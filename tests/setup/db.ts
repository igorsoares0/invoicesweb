import type { Prisma } from "@/generated/prisma/client";
import type { BusinessContext } from "@/server/auth/types";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";

export async function truncateAll() {
  // Guard against wiping a real database if the test environment is misconfigured.
  if (!/\/\w+_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to truncate: DATABASE_URL does not point at a *_test database.");
  }
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "BillingEvent", "Subscription", "EmailLog", "EstimateEvent", "EstimateItem", "Estimate", "InvoiceEvent", "Payment", "InvoiceItem", "Invoice", "Product", "Client", "Business", "Account", "Session", "VerificationToken", "User" CASCADE',
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

export type TestPlan = "TRIAL" | "FREE" | "PRO";

/**
 * A user with a business: the usual starting point for resource tests. Accounts start in the
 * reverse trial, as they do in production; limit tests ask for `plan: "FREE"` explicitly.
 */
export async function createAccount(overrides: { businessName?: string; plan?: TestPlan } = {}) {
  const plan = overrides.plan ?? "TRIAL";
  let user = await createUser();
  if (plan === "TRIAL") {
    user = await db.user.update({ where: { id: user.id }, data: { trialEndsAt: new Date(Date.now() + 14 * 86_400_000) } });
  }
  if (plan === "PRO") await createSubscription(user.id);
  const business = await db.business.create({
    data: { userId: user.id, name: overrides.businessName ?? `Business of ${user.email}` },
  });
  const context: BusinessContext = { userId: user.id, businessId: business.id };
  return { user, business, context };
}

/** An active Paddle subscription, as the webhook would have stored it. */
export function createSubscription(
  userId: string,
  overrides: Partial<Prisma.SubscriptionUncheckedCreateInput> = {},
) {
  const n = next();
  return db.subscription.create({
    data: {
      userId,
      plan: "PRO",
      status: "ACTIVE",
      provider: "PADDLE",
      providerSubscriptionId: `sub_test_${n}`,
      providerCustomerId: `ctm_test_${n}`,
      providerPriceId: "pri_test_pro_monthly",
      interval: "MONTH",
      currentPeriodStart: new Date(Date.now() - 5 * 86_400_000),
      currentPeriodEnd: new Date(Date.now() + 25 * 86_400_000),
      nextBilledAt: new Date(Date.now() + 25 * 86_400_000),
      ...overrides,
    },
  });
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
