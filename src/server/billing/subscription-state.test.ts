import { describe, expect, it } from "vitest";
import { TEST_BILLING_ENV } from "@tests/setup/billing-env.mjs";
import { subscriptionState } from "./subscription-state";

/** A subscription entity as a Paddle webhook delivers it. */
function webhookEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_01",
    status: "active",
    customer_id: "ctm_01",
    items: [{ price: { id: TEST_BILLING_ENV.PADDLE_PRICE_PRO_YEARLY }, quantity: 1 }],
    current_billing_period: { starts_at: "2026-09-18T12:00:00Z", ends_at: "2027-09-18T12:00:00Z" },
    next_billed_at: "2027-09-18T12:00:00Z",
    scheduled_change: null,
    custom_data: { userId: "user_1" },
    ...overrides,
  };
}

describe("subscriptionState", () => {
  it("reads a webhook payload", () => {
    expect(subscriptionState(webhookEntity())).toEqual({
      providerSubscriptionId: "sub_01",
      providerCustomerId: "ctm_01",
      providerPriceId: TEST_BILLING_ENV.PADDLE_PRICE_PRO_YEARLY,
      interval: "YEAR",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-09-18T12:00:00Z"),
      currentPeriodEnd: new Date("2027-09-18T12:00:00Z"),
      nextBilledAt: new Date("2027-09-18T12:00:00Z"),
      cancelAtPeriodEnd: false,
      userId: "user_1",
    });
  });

  it("reads the SDK's camelCase entity the same way", () => {
    const state = subscriptionState({
      id: "sub_01",
      status: "past_due",
      customerId: "ctm_01",
      items: [{ price: { id: TEST_BILLING_ENV.PADDLE_PRICE_PRO_MONTHLY } }],
      currentBillingPeriod: { startsAt: "2026-09-18T12:00:00Z", endsAt: "2026-10-18T12:00:00Z" },
      nextBilledAt: "2026-10-18T12:00:00Z",
      scheduledChange: { action: "cancel", effectiveAt: "2026-10-18T12:00:00Z" },
      customData: { userId: "user_1" },
    });
    expect(state).toMatchObject({ status: "PAST_DUE", interval: "MONTH", cancelAtPeriodEnd: true, userId: "user_1" });
  });

  it("marks a scheduled cancellation, and clears it when the change is withdrawn", () => {
    expect(subscriptionState(webhookEntity({ scheduled_change: { action: "cancel" } }))?.cancelAtPeriodEnd).toBe(true);
    expect(subscriptionState(webhookEntity({ scheduled_change: null }))?.cancelAtPeriodEnd).toBe(false);
    // A scheduled pause is not a cancellation.
    expect(subscriptionState(webhookEntity({ scheduled_change: { action: "pause" } }))?.cancelAtPeriodEnd).toBe(false);
  });

  it("ignores subscriptions for other products in the shared sandbox", () => {
    expect(subscriptionState(webhookEntity({ items: [{ price: { id: "pri_someone_else" } }] }))).toBeNull();
  });

  it("ignores entities it can't read", () => {
    expect(subscriptionState(null)).toBeNull();
    expect(subscriptionState(webhookEntity({ status: "mystery" }))).toBeNull();
    expect(subscriptionState(webhookEntity({ id: undefined }))).toBeNull();
  });

  it("copes with a missing userId, left for the caller to resolve", () => {
    expect(subscriptionState(webhookEntity({ custom_data: null }))?.userId).toBeNull();
  });
});
