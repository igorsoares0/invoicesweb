import { describe, expect, it } from "vitest";
import { resolvePlan, trialDaysLeft, type SubscriptionLike } from "./resolve";

const now = new Date("2026-09-18T12:00:00.000Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

function subscription(overrides: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    plan: "PRO",
    status: "ACTIVE",
    interval: "MONTH",
    providerCustomerId: "ctm_1",
    providerSubscriptionId: "sub_1",
    currentPeriodEnd: days(20),
    nextBilledAt: days(20),
    cancelAtPeriodEnd: false,
    updatedAt: days(-1),
    ...overrides,
  };
}

describe("resolvePlan", () => {
  it("is Free with no subscription and no trial", () => {
    expect(resolvePlan({ subscriptions: [], trialEndsAt: null, now })).toMatchObject({ plan: "FREE", source: "free" });
  });

  it("gives Pro during the trial, and Free from the exact instant it ends", () => {
    expect(resolvePlan({ subscriptions: [], trialEndsAt: days(3), now })).toMatchObject({
      plan: "PRO",
      source: "trial",
      trialEndsAt: days(3),
    });
    expect(resolvePlan({ subscriptions: [], trialEndsAt: now, now }).plan).toBe("FREE");
  });

  it("keeps Pro while a payment is being retried", () => {
    expect(resolvePlan({ subscriptions: [subscription({ status: "PAST_DUE" })], trialEndsAt: null, now }).plan).toBe("PRO");
  });

  it("keeps Pro until a scheduled cancellation takes effect", () => {
    const resolved = resolvePlan({ subscriptions: [subscription({ cancelAtPeriodEnd: true })], trialEndsAt: null, now });
    expect(resolved).toMatchObject({ plan: "PRO", source: "subscription" });
    expect(resolved.subscription?.cancelAtPeriodEnd).toBe(true);
  });

  it("drops to Free when canceled or paused, but still reports the subscription", () => {
    for (const status of ["CANCELED", "PAUSED"] as const) {
      const resolved = resolvePlan({ subscriptions: [subscription({ status })], trialEndsAt: null, now });
      expect(resolved).toMatchObject({ plan: "FREE", source: "free" });
      expect(resolved.subscription?.status).toBe(status);
    }
  });

  it("lets a paying subscription win over the trial", () => {
    expect(resolvePlan({ subscriptions: [subscription()], trialEndsAt: days(5), now }).source).toBe("subscription");
  });

  it("picks the live subscription when an old one was canceled", () => {
    const old = subscription({ status: "CANCELED", providerSubscriptionId: "sub_old", updatedAt: days(-0.5) });
    const current = subscription({ providerSubscriptionId: "sub_new", updatedAt: days(-3) });
    const resolved = resolvePlan({ subscriptions: [old, current], trialEndsAt: null, now });
    expect(resolved.plan).toBe("PRO");
    expect(resolved.subscription?.providerSubscriptionId).toBe("sub_new");
  });
});

describe("trialDaysLeft", () => {
  it("counts a partial day as a whole one", () => {
    expect(trialDaysLeft(days(8.2), now)).toBe(9);
    expect(trialDaysLeft(days(0.1), now)).toBe(1);
    expect(trialDaysLeft(days(-1), now)).toBe(0);
  });
});
