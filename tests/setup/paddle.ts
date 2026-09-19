import { randomUUID } from "node:crypto";
import { signPaddlePayload } from "@/server/billing/signature";
import { TEST_BILLING_ENV, TEST_WEBHOOK_SECRET } from "./billing-env.mjs";

/** A subscription entity shaped like a Paddle webhook's `data`. */
export function paddleSubscription(overrides: Record<string, unknown> = {}) {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 86_400_000);
  return {
    id: `sub_${randomUUID().slice(0, 8)}`,
    status: "active",
    customer_id: `ctm_${randomUUID().slice(0, 8)}`,
    items: [{ price: { id: TEST_BILLING_ENV.PADDLE_PRICE_PRO_MONTHLY }, quantity: 1 }],
    current_billing_period: { starts_at: start.toISOString(), ends_at: end.toISOString() },
    next_billed_at: end.toISOString(),
    scheduled_change: null,
    custom_data: null,
    ...overrides,
  };
}

export function paddleEvent(
  type: string,
  data: unknown,
  options: { eventId?: string; occurredAt?: Date } = {},
) {
  return {
    event_id: options.eventId ?? `evt_${randomUUID()}`,
    event_type: type,
    occurred_at: (options.occurredAt ?? new Date()).toISOString(),
    notification_id: `ntf_${randomUUID()}`,
    data,
  };
}

/** `callRoute` options for a delivery signed with the test secret. */
export function signedDelivery(event: unknown, secret: string = TEST_WEBHOOK_SECRET) {
  const rawBody = typeof event === "string" ? event : JSON.stringify(event);
  return { method: "POST", rawBody, headers: { "paddle-signature": signPaddlePayload(rawBody, secret) } };
}
