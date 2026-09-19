import type { BillingInterval, Plan, PlanSource, SubscriptionStatus } from "@/lib/api-types";

export interface SubscriptionLike {
  plan: Plan;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  nextBilledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: Date;
}

export interface ResolvedPlan {
  plan: Plan;
  source: PlanSource;
  /** The subscription that grants the plan, or the most relevant one to show. */
  subscription: SubscriptionLike | null;
  /** Only set while the trial is what grants Pro. */
  trialEndsAt: Date | null;
}

/**
 * Statuses that keep Pro. PAST_DUE stays Pro while Paddle retries the payment; its dunning
 * settings cancel or pause the subscription if the retries run out. A scheduled cancellation
 * keeps the status ACTIVE until the period ends, so it needs no special case.
 */
const GRANTING: readonly SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

function rank(subscription: SubscriptionLike): number {
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") return 2;
  if (subscription.status === "PAST_DUE") return 1;
  return 0;
}

/**
 * The plan a user has right now. A paying subscription wins over the trial; when several exist
 * (a resubscription, or two checkouts at once) the strongest one decides, newest first.
 */
export function resolvePlan(input: {
  subscriptions: readonly SubscriptionLike[];
  trialEndsAt: Date | null;
  now: Date;
}): ResolvedPlan {
  const ordered = [...input.subscriptions].sort(
    (a, b) => rank(b) - rank(a) || b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  const best = ordered[0] ?? null;

  if (best && best.plan === "PRO" && GRANTING.includes(best.status)) {
    return { plan: "PRO", source: "subscription", subscription: best, trialEndsAt: null };
  }
  // The trial is Pro until the exact instant it ends.
  if (input.trialEndsAt && input.trialEndsAt.getTime() > input.now.getTime()) {
    return { plan: "PRO", source: "trial", subscription: best, trialEndsAt: input.trialEndsAt };
  }
  return { plan: "FREE", source: "free", subscription: best, trialEndsAt: null };
}

/** "9 days left": a partial day still counts, so the last day reads "1 day left", never 0. */
export function trialDaysLeft(trialEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}
