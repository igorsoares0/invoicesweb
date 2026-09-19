import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { TEST_BILLING_ENV } from "@tests/setup/billing-env.mjs";
import { createAccount, createSubscription } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { db } from "@/server/db";
import { POST as checkout } from "./checkout/route";
import { POST as portal } from "./portal/route";
import { GET as summary } from "./route";
import { POST as sync } from "./sync/route";

/** A stand-in for the Paddle SDK client: every call is recorded, nothing leaves the process. */
const paddle = vi.hoisted(() => ({
  enabled: true,
  transactions: { create: vi.fn(), get: vi.fn() },
  subscriptions: { get: vi.fn() },
  customerPortalSessions: { create: vi.fn() },
}));

vi.mock("@/server/billing/paddle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/billing/paddle")>()),
  paddleClient: async () => (paddle.enabled ? paddle : null),
}));

const TXN = "txn_01abcdefghjkmnpqrstvwxyz01";

beforeEach(() => {
  paddle.enabled = true;
  paddle.transactions.create.mockReset().mockResolvedValue({ id: TXN });
  paddle.transactions.get.mockReset();
  paddle.subscriptions.get.mockReset();
  paddle.customerPortalSessions.create.mockReset();
});

async function signedIn(plan: "TRIAL" | "FREE" | "PRO" = "TRIAL") {
  const account = await createAccount({ plan });
  signInAs(account.user.id);
  return account;
}

describe("GET /api/v1/billing", () => {
  it("returns the plan summary", async () => {
    await signedIn("FREE");
    expect((await callRoute(summary)).json.data).toMatchObject({ plan: "FREE", usage: { limit: 3 } });
  });
});

describe("POST /api/v1/billing/checkout", () => {
  it("creates the transaction on the server, tied to the account", async () => {
    const { user } = await signedIn();

    const { status, json } = await callRoute(checkout, { method: "POST", body: { interval: "YEAR" } });

    expect(status).toBe(200);
    expect(json.data).toEqual({ transactionId: TXN, customerEmail: user.email });
    // No checkout URL configured: Paddle falls back to the account's default payment link.
    expect(paddle.transactions.create).toHaveBeenCalledWith({
      items: [{ priceId: TEST_BILLING_ENV.PADDLE_PRICE_PRO_YEARLY, quantity: 1 }],
      customData: { userId: user.id },
    });
  });

  it("points Paddle's payment links at the configured page, on an approved domain", async () => {
    await signedIn();
    process.env.PADDLE_CHECKOUT_URL = "https://app.example.com/pricing";
    try {
      await callRoute(checkout, { method: "POST", body: { interval: "MONTH" } });
    } finally {
      process.env.PADDLE_CHECKOUT_URL = "";
    }
    expect(paddle.transactions.create.mock.calls[0][0]).toMatchObject({ checkout: { url: "https://app.example.com/pricing" } });
  });

  it("turns a Paddle refusal into a plain message instead of a 500", async () => {
    await signedIn();
    paddle.transactions.create.mockRejectedValue(
      Object.assign(new Error("not approved"), { code: "transaction_checkout_url_domain_is_not_approved" }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { status, json } = await callRoute(checkout, { method: "POST", body: { interval: "MONTH" } });

    expect(status).toBe(402);
    expect(json.error).toMatchObject({ code: "PAYMENT_ERROR", message: "Paddle couldn't start the checkout. Try again in a moment." });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("reuses the Paddle customer of an earlier subscription", async () => {
    const { user } = await signedIn("FREE");
    await createSubscription(user.id, { status: "CANCELED", providerCustomerId: "ctm_earlier" });

    await callRoute(checkout, { method: "POST", body: { interval: "MONTH" } });

    expect(paddle.transactions.create.mock.calls[0][0]).toMatchObject({ customerId: "ctm_earlier" });
  });

  it("refuses a second subscription, which would charge twice", async () => {
    await signedIn("PRO");

    const { status, json } = await callRoute(checkout, { method: "POST", body: { interval: "MONTH" } });

    expect(status).toBe(409);
    expect(json.error.message).toMatch(/already on Pro/);
    expect(paddle.transactions.create).not.toHaveBeenCalled();
  });

  it("validates the interval", async () => {
    await signedIn();
    expect((await callRoute(checkout, { method: "POST", body: { interval: "WEEK" } })).status).toBe(422);
  });

  it("says when billing isn't configured", async () => {
    await signedIn();
    paddle.enabled = false;

    const { status, json } = await callRoute(checkout, { method: "POST", body: { interval: "MONTH" } });

    expect(status).toBe(503);
    expect(json.error.code).toBe("BILLING_DISABLED");
  });
});

describe("POST /api/v1/billing/sync", () => {
  function subscriptionFor(userId: string | null) {
    return {
      id: "sub_synced",
      status: "active",
      customerId: "ctm_synced",
      updatedAt: new Date().toISOString(),
      items: [{ price: { id: TEST_BILLING_ENV.PADDLE_PRICE_PRO_MONTHLY } }],
      currentBillingPeriod: { startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() },
      nextBilledAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      scheduledChange: null,
      customData: userId ? { userId } : null,
    };
  }

  it("activates Pro from a completed checkout without waiting for the webhook", async () => {
    const { user } = await signedIn("FREE");
    paddle.transactions.get.mockResolvedValue({ id: TXN, customData: { userId: user.id }, subscriptionId: "sub_synced" });
    paddle.subscriptions.get.mockResolvedValue(subscriptionFor(user.id));

    const { status, json } = await callRoute(sync, { method: "POST", body: { transactionId: TXN } });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({ plan: "PRO", source: "subscription", canManage: true });
    expect(await db.subscription.count({ where: { userId: user.id } })).toBe(1);
  });

  it("won't touch a checkout that belongs to someone else", async () => {
    await signedIn("FREE");
    paddle.transactions.get.mockResolvedValue({ id: TXN, customData: { userId: "someone_else" }, subscriptionId: "sub_x" });

    const { status } = await callRoute(sync, { method: "POST", body: { transactionId: TXN } });

    expect(status).toBe(404);
    expect(paddle.subscriptions.get).not.toHaveBeenCalled();
    expect(await db.subscription.count()).toBe(0);
  });

  it("reports the plan unchanged while Paddle is still creating the subscription", async () => {
    const { user } = await signedIn("FREE");
    paddle.transactions.get.mockResolvedValue({ id: TXN, customData: { userId: user.id }, subscriptionId: null });

    expect((await callRoute(sync, { method: "POST", body: { transactionId: TXN } })).json.data.plan).toBe("FREE");
  });

  it("rejects a malformed transaction id before calling Paddle", async () => {
    await signedIn();
    expect((await callRoute(sync, { method: "POST", body: { transactionId: "nope" } })).status).toBe(422);
    expect(paddle.transactions.get).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/billing/portal", () => {
  it("returns signed-in portal links for the live subscription", async () => {
    const { user } = await signedIn("FREE");
    const live = await createSubscription(user.id, { providerCustomerId: "ctm_live" });
    await createSubscription(user.id, { status: "CANCELED", providerCustomerId: "ctm_live" });
    paddle.customerPortalSessions.create.mockResolvedValue({
      urls: {
        general: { overview: "https://portal.example/overview" },
        subscriptions: [{ id: live.providerSubscriptionId, cancelSubscription: "https://portal.example/cancel", updateSubscriptionPaymentMethod: "https://portal.example/card" }],
      },
    });

    const { status, json } = await callRoute(portal, { method: "POST" });

    expect(status).toBe(200);
    expect(json.data).toEqual({
      overview: "https://portal.example/overview",
      updatePaymentMethod: "https://portal.example/card",
      cancel: "https://portal.example/cancel",
    });
    expect(paddle.customerPortalSessions.create).toHaveBeenCalledWith("ctm_live", [live.providerSubscriptionId]);
  });

  it("has nothing to manage before the first subscription", async () => {
    await signedIn();
    expect((await callRoute(portal, { method: "POST" })).status).toBe(409);
  });
});
