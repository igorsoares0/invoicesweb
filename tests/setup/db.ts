import type { BusinessContext } from "@/server/auth/types";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";

export async function truncateAll() {
  // Guard against wiping a real database if the test environment is misconfigured.
  if (!/\/\w+_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to truncate: DATABASE_URL does not point at a *_test database.");
  }
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "EmailLog", "EstimateEvent", "EstimateItem", "Estimate", "InvoiceEvent", "Payment", "InvoiceItem", "Invoice", "Product", "Client", "Business", "Account", "Session", "VerificationToken", "User" CASCADE',
  );
}

let sequence = 0;
const next = () => ++sequence;

export async function createUser(overrides: { email?: string; password?: string; name?: string } = {}) {
  const n = next();
  return db.user.create({
    data: {
      email: overrides.email ?? `user${n}@example.com`,
      name: overrides.name ?? `User ${n}`,
      passwordHash: overrides.password ? await hashPassword(overrides.password) : null,
    },
  });
}

/** A user with a business: the usual starting point for resource tests. */
export async function createAccount(overrides: { businessName?: string } = {}) {
  const user = await createUser();
  const business = await db.business.create({
    data: { userId: user.id, name: overrides.businessName ?? `Business of ${user.email}` },
  });
  const context: BusinessContext = { userId: user.id, businessId: business.id };
  return { user, business, context };
}

export function createClientRecord(businessId: string, data: { name: string; email?: string; company?: string }) {
  return db.client.create({ data: { businessId, ...data } });
}

export function createProductRecord(
  businessId: string,
  data: { name: string; unitPrice?: string; description?: string },
) {
  return db.product.create({ data: { businessId, unitPrice: "100.00", ...data } });
}

/** A line as the editor sends it. */
export function lineInput(overrides: Record<string, unknown> = {}) {
  return {
    id: `line_${Math.random().toString(36).slice(2, 12)}`,
    description: "Website redesign — discovery & IA",
    quantity: "1",
    unitPrice: "2400",
    discountType: null,
    discountValue: null,
    taxRate: "0",
    taxExempt: false,
    ...overrides,
  };
}
