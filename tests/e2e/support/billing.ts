import type { APIRequestContext } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { TEST_BILLING_ENV, TEST_WEBHOOK_SECRET } from "../../setup/billing-env.mjs";

/**
 * Delivers a signed `subscription.created` to the test server, as Paddle would after a checkout.
 * The overlay itself talks to Paddle's servers, so E2E starts from the webhook.
 */
export async function subscribeViaWebhook(request: APIRequestContext, userId: string) {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 86_400_000);
  const body = JSON.stringify({
    event_id: `evt_${randomUUID()}`,
    event_type: "subscription.created",
    occurred_at: start.toISOString(),
    data: {
      id: `sub_${randomUUID().slice(0, 8)}`,
      status: "active",
      customer_id: `ctm_${randomUUID().slice(0, 8)}`,
      items: [{ price: { id: TEST_BILLING_ENV.PADDLE_PRICE_PRO_MONTHLY }, quantity: 1 }],
      current_billing_period: { starts_at: start.toISOString(), ends_at: end.toISOString() },
      next_billed_at: end.toISOString(),
      scheduled_change: null,
      custom_data: { userId },
    },
  });
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", TEST_WEBHOOK_SECRET).update(`${ts}:${body}`).digest("hex");
  const response = await request.post("/api/webhooks/paddle", {
    data: body,
    headers: { "content-type": "application/json", "paddle-signature": `ts=${ts};h1=${h1}` },
  });
  if (!response.ok()) throw new Error(`Webhook refused: ${response.status()} ${await response.text()}`);
}
