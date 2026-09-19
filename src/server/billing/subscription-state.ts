import "server-only";
import type { BillingInterval, SubscriptionStatus } from "@/lib/api-types";
import { intervalOfPrice } from "./paddle";

/** A Paddle subscription reduced to what we store, whichever way it reached us. */
export interface SubscriptionState {
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  providerPriceId: string;
  interval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBilledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Set by our checkout through the transaction's custom_data, which Paddle copies over. */
  userId: string | null;
}

const STATUSES: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  paused: "PAUSED",
  canceled: "CANCELED",
};

const date = (value: unknown) => (typeof value === "string" && value ? new Date(value) : null);
const text = (value: unknown) => (typeof value === "string" && value ? value : null);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/**
 * Builds the state from a subscription entity. Webhooks deliver it in snake_case and the SDK in
 * camelCase, so both spellings are read. Returns null when the subscription isn't for one of our
 * prices: the sandbox is shared with other products, whose events reach the same webhook.
 */
export function subscriptionState(entity: unknown): SubscriptionState | null {
  const data = record(entity);
  const items = Array.isArray(data.items) ? data.items.map(record) : [];
  let priceId: string | null = null;
  let interval: BillingInterval | null = null;
  for (const item of items) {
    const id = text(record(item.price).id) ?? text(item.price_id) ?? text(item.priceId);
    const matched = id ? intervalOfPrice(id) : null;
    if (id && matched) {
      priceId = id;
      interval = matched;
      break;
    }
  }

  const id = text(data.id);
  const status = STATUSES[String(data.status)];
  if (!id || !status || !priceId || !interval) return null;

  const period = record(data.current_billing_period ?? data.currentBillingPeriod);
  const scheduled = record(data.scheduled_change ?? data.scheduledChange);
  const custom = record(data.custom_data ?? data.customData);

  return {
    providerSubscriptionId: id,
    providerCustomerId: text(data.customer_id ?? data.customerId),
    providerPriceId: priceId,
    interval,
    status,
    currentPeriodStart: date(period.starts_at ?? period.startsAt),
    currentPeriodEnd: date(period.ends_at ?? period.endsAt),
    nextBilledAt: date(data.next_billed_at ?? data.nextBilledAt),
    // Un-cancelling in the portal sends `scheduled_change: null`, which resets this.
    cancelAtPeriodEnd: scheduled.action === "cancel",
    userId: text(custom.userId),
  };
}
