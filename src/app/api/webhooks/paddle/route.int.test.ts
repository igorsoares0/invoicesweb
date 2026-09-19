import { describe, expect, it } from "vitest";
import { createAccount } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { paddleEvent, paddleSubscription, signedDelivery } from "@tests/setup/paddle";
import { db } from "@/server/db";
import { billingService } from "@/server/services/billing-service";
import { POST } from "./route";

const deliver = (event: unknown, secret?: string) => callRoute(POST, signedDelivery(event, secret));

async function planOf(userId: string, businessId: string) {
  return billingService.summary({ userId, businessId });
}

describe("POST /api/webhooks/paddle", () => {
  it("refuses a bad signature or a body it can't read", async () => {
    const event = paddleEvent("subscription.created", paddleSubscription());
    expect((await deliver(event, "not_the_secret")).json.error.code).toBe("WEBHOOK_INVALID");
    expect((await callRoute(POST, { method: "POST", rawBody: JSON.stringify(event) })).status).toBe(400);
    expect((await deliver("{not json")).status).toBe(400);
    expect(await db.billingEvent.count()).toBe(0);
  });

  it("turns a new subscription into Pro and ends the trial for good", async () => {
    const { user, business } = await createAccount();
    const subscription = paddleSubscription({ custom_data: { userId: user.id } });

    const { status, json } = await deliver(paddleEvent("subscription.created", subscription));

    expect(status).toBe(200);
    expect(json.data.outcome).toBe("applied");
    expect(await planOf(user.id, business.id)).toMatchObject({ plan: "PRO", source: "subscription", interval: "MONTH" });
    const { trialEndsAt } = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(trialEndsAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("records a repeated delivery once", async () => {
    const { user } = await createAccount();
    const event = paddleEvent("subscription.created", paddleSubscription({ custom_data: { userId: user.id } }));

    const results = await Promise.all([deliver(event), deliver(event)]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results.map((result) => result.json.data.outcome).sort()).toEqual(["applied", "duplicate"]);
    expect(await db.billingEvent.count()).toBe(1);
    expect(await db.subscription.count()).toBe(1);
  });

  it("ignores other products in the shared sandbox, and answers 200 so Paddle stops retrying", async () => {
    const { user } = await createAccount();
    const foreign = paddleSubscription({ custom_data: { userId: user.id }, items: [{ price: { id: "pri_superscaler" } }] });

    const { status, json } = await deliver(paddleEvent("subscription.created", foreign));

    expect(status).toBe(200);
    expect(json.data.outcome).toBe("ignored");
    expect(await db.subscription.count()).toBe(0);
    expect((await db.billingEvent.findFirstOrThrow()).outcome).toBe("ignored");
  });

  it("ignores a subscription it can't tie to an account", async () => {
    const { json } = await deliver(paddleEvent("subscription.created", paddleSubscription({ custom_data: { userId: "nobody" } })));
    expect(json.data.outcome).toBe("ignored");
    expect(await db.subscription.count()).toBe(0);
  });

  it("ignores event types that don't change the plan", async () => {
    const { json } = await deliver(paddleEvent("transaction.completed", { id: "txn_1" }));
    expect(json.data.outcome).toBe("ignored");
  });

  it("ends up right when an update arrives before the creation", async () => {
    const { user, business } = await createAccount({ plan: "FREE" });
    const subscription = paddleSubscription({ custom_data: { userId: user.id } });
    const created = new Date(Date.now() - 60_000);

    await deliver(paddleEvent("subscription.updated", { ...subscription, scheduled_change: { action: "cancel" } }));
    const late = await deliver(paddleEvent("subscription.created", subscription, { occurredAt: created }));

    expect(late.json.data.outcome).toBe("stale");
    expect(await planOf(user.id, business.id)).toMatchObject({ plan: "PRO", cancelAtPeriodEnd: true });
  });

  it("applies two events stamped with the same instant, in arrival order", async () => {
    const { user, business } = await createAccount({ plan: "FREE" });
    const subscription = paddleSubscription({ custom_data: { userId: user.id } });
    const at = new Date();

    await deliver(paddleEvent("subscription.created", subscription, { occurredAt: at }));
    const second = await deliver(paddleEvent("subscription.updated", { ...subscription, status: "past_due" }, { occurredAt: at }));

    expect(second.json.data.outcome).toBe("applied");
    expect(await planOf(user.id, business.id)).toMatchObject({ plan: "PRO", status: "PAST_DUE" });
  });

  it("finds the account from the stored subscription when custom_data is gone", async () => {
    const { user, business } = await createAccount({ plan: "FREE" });
    const subscription = paddleSubscription({ custom_data: { userId: user.id } });
    await deliver(paddleEvent("subscription.created", subscription));

    await deliver(paddleEvent("subscription.canceled", { ...subscription, status: "canceled", custom_data: null }));

    expect(await planOf(user.id, business.id)).toMatchObject({ plan: "FREE", status: "CANCELED" });
  });

  it("doesn't let a late event for an old subscription downgrade a newer one", async () => {
    const { user, business } = await createAccount({ plan: "FREE" });
    const old = paddleSubscription({ custom_data: { userId: user.id } });
    const renewed = paddleSubscription({ custom_data: { userId: user.id }, customer_id: old.customer_id });
    await deliver(paddleEvent("subscription.created", old, { occurredAt: new Date(Date.now() - 120_000) }));
    await deliver(paddleEvent("subscription.created", renewed));

    await deliver(paddleEvent("subscription.canceled", { ...old, status: "canceled" }));

    expect(await planOf(user.id, business.id)).toMatchObject({ plan: "PRO", status: "ACTIVE" });
  });

  it("keeps Pro while a payment is being retried, and drops it when canceled", async () => {
    const { user, business } = await createAccount({ plan: "FREE" });
    const subscription = paddleSubscription({ custom_data: { userId: user.id } });
    await deliver(paddleEvent("subscription.created", subscription, { occurredAt: new Date(Date.now() - 2000) }));

    await deliver(paddleEvent("subscription.updated", { ...subscription, status: "past_due" }, { occurredAt: new Date(Date.now() - 1000) }));
    expect((await planOf(user.id, business.id)).plan).toBe("PRO");

    await deliver(paddleEvent("subscription.canceled", { ...subscription, status: "canceled" }));
    expect((await planOf(user.id, business.id)).plan).toBe("FREE");
  });
});
