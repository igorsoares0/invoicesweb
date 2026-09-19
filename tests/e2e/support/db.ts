import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import pg from "pg";

let pool: pg.Pool | undefined;

function getPool() {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 2 });
  return pool;
}

export const TEST_PASSWORD = "Correct-Horse-Battery-9";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@e2e.test`;
}

/**
 * Creates a user (and optionally a business) straight in the database, so most specs start
 * signed-up without going through the rate-limited sign-up form.
 */
/**
 * Accounts start in the reverse trial, as they do after onboarding in production. Billing specs
 * pass `plan: "FREE"` to start on the free plan.
 */
export async function createAccount(
  options: { businessName?: string | null; email?: string; plan?: "TRIAL" | "FREE" } = {},
) {
  const email = options.email ?? uniqueEmail("user");
  const userId = `e2e${randomUUID().replaceAll("-", "")}`;
  const passwordHash = await hash(TEST_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const db = getPool();
  const trialEndsAt = (options.plan ?? "TRIAL") === "TRIAL" ? new Date(Date.now() + 14 * 86_400_000) : null;

  await db.query(
    `INSERT INTO "User" (id, email, "passwordHash", "trialEndsAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, now(), now())`,
    [userId, email, passwordHash, trialEndsAt],
  );
  const businessName = options.businessName === undefined ? "Alvorada Studio" : options.businessName;
  const businessId = businessName ? `e2e${randomUUID().replaceAll("-", "")}` : null;
  if (businessName) {
    await db.query(
      `INSERT INTO "Business" (id, "userId", name, email, "paymentInstructions", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [businessId, userId, businessName, "hello@alvorada.studio", "Bank transfer — IBAN PT50 0002 0123 1234 5678 9015 4"],
    );
  }
  return { email, password: TEST_PASSWORD, userId, businessId: businessId! };
}

const id = () => `e2e${randomUUID().replaceAll("-", "")}`;

export async function createClient(businessId: string, data: { name: string; email?: string }) {
  const clientId = id();
  await getPool().query(
    `INSERT INTO "Client" (id, "businessId", name, email, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, now(), now())`,
    [clientId, businessId, data.name, data.email ?? null],
  );
  return clientId;
}

export async function createProduct(businessId: string, data: { name: string; unitPrice: string; taxRate?: string }) {
  const productId = id();
  await getPool().query(
    `INSERT INTO "Product" (id, "businessId", name, "unitPrice", "taxRate", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [productId, businessId, data.name, data.unitPrice, data.taxRate ?? "0"],
  );
  return productId;
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}

export interface EmailRow {
  recipients: string[];
  subject: string;
  status: string;
  attachedPdf: boolean;
  copyToSelf: boolean;
}

/**
 * What the app logged for a document. The E2E server runs in its own process with
 * EMAIL_TRANSPORT=capture, so the database is the only place a spec can see an email.
 */
export async function emailsFor(businessId: string, number: string): Promise<EmailRow[]> {
  const { rows } = await getPool().query<EmailRow>(
    `SELECT e.recipients, e.subject, e.status, e."attachedPdf", e."copyToSelf"
       FROM "EmailLog" e
       LEFT JOIN "Invoice" i ON i.id = e."invoiceId"
       LEFT JOIN "Estimate" s ON s.id = e."estimateId"
      WHERE e."businessId" = $1 AND COALESCE(i.number, s.number) = $2
      ORDER BY e."createdAt" ASC`,
    [businessId, number],
  );
  return rows;
}

/** Moves an estimate's expiry date into the past, to exercise the expired states. */
export async function expireEstimate(number: string, businessId: string) {
  await getPool().query(`UPDATE "Estimate" SET "expiryDate" = '2020-01-01' WHERE number = $1 AND "businessId" = $2`, [
    number,
    businessId,
  ]);
}

/** Fills this month's quota: invoices already sent, stamped straight in the database. */
export async function alreadySent(businessId: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    await getPool().query(
      `INSERT INTO "Invoice" (id, "businessId", sequence, number, status, "issueDate", "dueDate", currency, "sentAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'SENT', now(), now(), 'USD', now(), now(), now())`,
      [id(), businessId, 900 + i, `INV-${900 + i}`],
    );
  }
}

/** Picks a template for a draft without going through the picker (tests of the send gate). */
export async function setTemplate(businessId: string, number: string, template: string) {
  await getPool().query(`UPDATE "Invoice" SET template = $3 WHERE "businessId" = $1 AND number = $2`, [
    businessId,
    number,
    template,
  ]);
}
