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
export async function createAccount(options: { businessName?: string | null; email?: string } = {}) {
  const email = options.email ?? uniqueEmail("user");
  const userId = `e2e${randomUUID().replaceAll("-", "")}`;
  const passwordHash = await hash(TEST_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const db = getPool();

  await db.query(
    `INSERT INTO "User" (id, email, "passwordHash", "createdAt", "updatedAt") VALUES ($1, $2, $3, now(), now())`,
    [userId, email, passwordHash],
  );
  const businessName = options.businessName === undefined ? "Alvorada Studio" : options.businessName;
  if (businessName) {
    await db.query(
      `INSERT INTO "Business" (id, "userId", name, "createdAt", "updatedAt") VALUES ($1, $2, $3, now(), now())`,
      [`e2e${randomUUID().replaceAll("-", "")}`, userId, businessName],
    );
  }
  return { email, password: TEST_PASSWORD, userId };
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}
