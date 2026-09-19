import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DocumentTemplate, PlanSummaryDto } from "@/lib/api-types";
import { proOptionsUsed } from "@/lib/billing/pro-options";
import { formatLongDate } from "@/lib/dates";
import { checkoutSchema, syncCheckoutSchema } from "@/lib/validation/billing";
import { toFieldErrors } from "@/lib/validation/errors";
import { ApiError, ErrorCode } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { paddleClient, proPrices, webhookSecret } from "@/server/billing/paddle";
import { verifyPaddleSignature } from "@/server/billing/signature";
import { subscriptionState, type SubscriptionState } from "@/server/billing/subscription-state";
import { db } from "@/server/db";
import { getEntitlements } from "@/server/entitlements/entitlements";
import { PLANS } from "@/server/entitlements/plans";
import { resolvePlan, type ResolvedPlan } from "@/server/entitlements/resolve";
import { billingRepository } from "@/server/repositories/billing-repository";
import type { Tx } from "@/server/repositories/invoice-repository";
import { isPrismaError } from "@/server/repositories/prisma-errors";

/** Length of the reverse trial every new account starts with. */
export const TRIAL_DAYS = 14;

type Client = Tx | typeof db;

/** Subscriptions that are still billing: a second checkout would charge twice. */
const LIVE: readonly string[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

export const billingService = {
  /** The plan a user has right now (spec §21: the backend is the authority). */
  async planFor(userId: string, now: Date = new Date(), client: Client = db): Promise<ResolvedPlan> {
    // Sequential on purpose: inside a transaction both run on one connection.
    const user = await client.user.findUniqueOrThrow({ where: { id: userId }, select: { trialEndsAt: true } });
    const subscriptions = await billingRepository.subscriptionsOf(userId, client);
    return resolvePlan({ subscriptions, trialEndsAt: user.trialEndsAt, now });
  },

  async summary(context: BusinessContext, now: Date = new Date()): Promise<PlanSummaryDto> {
    const [resolved, usage] = await Promise.all([
      this.planFor(context.userId, now),
      billingRepository.sentThisMonth(context.businessId, now),
    ]);
    const subscription = resolved.subscription;
    return {
      plan: resolved.plan,
      source: resolved.source,
      status: subscription?.status ?? null,
      interval: subscription?.interval ?? null,
      trialEndsAt: resolved.trialEndsAt?.toISOString() ?? null,
      nextBilledAt: subscription?.nextBilledAt?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      canManage: Boolean(subscription?.providerCustomerId),
      usage: { sent: usage.sent, limit: PLANS[resolved.plan].invoicesPerMonth, resetsOn: usage.resetsOn },
      entitlements: getEntitlements(resolved.plan),
    };
  },

  /**
   * The send gate (spec §21, §50). Runs inside the send transaction, after the Business row lock,
   * so the monthly count can't be raced. The limit is checked first: it's the one the user can't
   * fix by editing. Returns whether the sent document carries the "Made with" mark.
   */
  async assertSendAllowed(
    tx: Tx,
    context: BusinessContext,
    document: { template: DocumentTemplate; color: string },
    options: { countsTowardLimit: boolean },
    now: Date = new Date(),
  ): Promise<{ branded: boolean }> {
    const resolved = await this.planFor(context.userId, now, tx);
    const entitlements = getEntitlements(resolved.plan);
    const limit = entitlements.limits.invoicesPerMonth;

    if (options.countsTowardLimit && limit !== null) {
      const { sent, resetsOn } = await billingRepository.sentThisMonth(context.businessId, now, tx);
      if (sent >= limit) {
        throw new ApiError(
          ErrorCode.PLAN_LIMIT_REACHED,
          `You've sent all ${limit} invoices included this month. Sending more needs Pro, or a wait until ${formatLongDate(resetsOn)}.`,
        );
      }
    }

    const used = proOptionsUsed(document, entitlements.features);
    if (used.length) {
      const details: Record<string, string[]> = {};
      if (used.includes("template")) details.template = ["This template is part of Pro"];
      if (used.includes("color")) details.color = ["A custom accent colour is part of Pro"];
      throw new ApiError(ErrorCode.SUBSCRIPTION_REQUIRED, "This document uses Pro options.", { details });
    }

    return { branded: entitlements.features.hasBrandingMark };
  },

  /**
   * Stores a subscription's full state (every event carries the whole entity, so order doesn't
   * matter as long as older state never overwrites newer). Finds the user through our checkout's
   * custom_data, then an already-stored row, then the Paddle customer.
   */
  async applySubscription(tx: Tx, state: SubscriptionState, occurredAt: Date): Promise<"applied" | "ignored" | "stale"> {
    const existing = await tx.subscription.findUnique({ where: { providerSubscriptionId: state.providerSubscriptionId } });
    if (existing?.lastEventAt && existing.lastEventAt.getTime() > occurredAt.getTime()) return "stale";

    let userId = existing?.userId ?? null;
    if (!userId && state.userId) {
      userId = (await tx.user.findUnique({ where: { id: state.userId }, select: { id: true } }))?.id ?? null;
    }
    if (!userId && state.providerCustomerId) {
      userId =
        (await tx.subscription.findFirst({ where: { providerCustomerId: state.providerCustomerId }, select: { userId: true } }))
          ?.userId ?? null;
    }
    if (!userId) return "ignored";

    const data = {
      plan: "PRO" as const,
      status: state.status,
      providerCustomerId: state.providerCustomerId,
      providerPriceId: state.providerPriceId,
      interval: state.interval,
      currentPeriodStart: state.currentPeriodStart,
      currentPeriodEnd: state.currentPeriodEnd,
      nextBilledAt: state.nextBilledAt,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      lastEventAt: occurredAt,
    };
    await tx.subscription.upsert({
      where: { providerSubscriptionId: state.providerSubscriptionId },
      create: { ...data, userId, provider: "PADDLE", providerSubscriptionId: state.providerSubscriptionId },
      update: data,
    });
    // Paying ends the trial for good, so cancelling later can't bring trial days back.
    await tx.user.updateMany({ where: { id: userId, trialEndsAt: { gt: occurredAt } }, data: { trialEndsAt: occurredAt } });
    return "applied";
  },

  /**
   * A Paddle webhook (spec §51): verify, record once, apply. The event row is inserted first in the
   * same transaction, so a concurrent duplicate fails on the unique key and a failure rolls back
   * everything — Paddle then retries.
   */
  async handlePaddleWebhook(rawBody: string, signature: string | null): Promise<{ outcome: string }> {
    const secret = webhookSecret();
    if (!secret) throw new ApiError(ErrorCode.BILLING_DISABLED, "Billing webhooks aren't configured.");
    if (!verifyPaddleSignature(rawBody, signature, secret)) {
      throw new ApiError(ErrorCode.WEBHOOK_INVALID, "Invalid webhook signature.");
    }

    let event: { event_id?: unknown; event_type?: unknown; occurred_at?: unknown; data?: unknown };
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new ApiError(ErrorCode.WEBHOOK_INVALID, "The webhook body isn't valid JSON.");
    }
    const eventId = typeof event.event_id === "string" ? event.event_id : null;
    const type = typeof event.event_type === "string" ? event.event_type : null;
    const occurredAt = typeof event.occurred_at === "string" ? new Date(event.occurred_at) : null;
    if (!eventId || !type || !occurredAt || Number.isNaN(occurredAt.getTime())) {
      throw new ApiError(ErrorCode.WEBHOOK_INVALID, "The webhook is missing its id, type or time.");
    }

    try {
      return await db.$transaction(async (tx) => {
        const row = await tx.billingEvent.create({
          data: {
            provider: "PADDLE",
            eventId,
            type,
            occurredAt,
            outcome: "ignored",
            payload: JSON.parse(rawBody) as Prisma.InputJsonValue,
          },
        });
        const state = type.startsWith("subscription.") ? subscriptionState(event.data) : null;
        const outcome = state ? await this.applySubscription(tx, state, occurredAt) : "ignored";
        if (outcome !== "ignored") await tx.billingEvent.update({ where: { id: row.id }, data: { outcome } });
        return { outcome };
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) return { outcome: "duplicate" };
      throw error;
    }
  },

  /**
   * Starts a Paddle checkout for Pro. The transaction is created here, not in the browser, so the
   * price and the account (`custom_data.userId`) can't be changed client-side. The customer isn't
   * created here either: the overlay finds or creates it from the email, which avoids clashing with
   * other products' customers in a shared account.
   */
  async checkout(
    context: BusinessContext,
    input: unknown,
    origin: string,
  ): Promise<{ transactionId: string; customerEmail: string }> {
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const paddle = await this.requirePaddle();

    const subscriptions = await billingRepository.subscriptionsOf(context.userId);
    if (subscriptions.some((subscription) => LIVE.includes(subscription.status))) {
      throw ApiError.conflict("You're already on Pro. Manage your subscription from Settings → Plan & billing.");
    }
    const customerId = subscriptions.find((subscription) => subscription.providerCustomerId)?.providerCustomerId;
    const user = await db.user.findUniqueOrThrow({ where: { id: context.userId }, select: { email: true } });

    const transaction = await paddle.transactions.create({
      items: [{ priceId: proPrices()[parsed.data.interval]!, quantity: 1 }],
      customData: { userId: context.userId },
      ...(customerId ? { customerId } : {}),
      // Our own page, not the account's default payment link, which other products share.
      checkout: { url: `${origin}/pricing` },
    });
    return { transactionId: transaction.id, customerEmail: user.email };
  },

  /**
   * Pulls a completed checkout's subscription straight from Paddle, so Pro shows up without
   * waiting for the webhook (or without one at all, in local development).
   */
  async syncCheckout(context: BusinessContext, input: unknown): Promise<PlanSummaryDto> {
    const parsed = syncCheckoutSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const paddle = await this.requirePaddle();

    const transaction = await paddle.transactions.get(parsed.data.transactionId);
    // Someone else's checkout reads as missing, never as someone else's data.
    if (transaction.customData?.userId !== context.userId) throw ApiError.notFound("Checkout");
    if (transaction.subscriptionId) {
      const subscription = await paddle.subscriptions.get(transaction.subscriptionId);
      const state = subscriptionState(subscription);
      if (state) {
        await db.$transaction((tx) =>
          this.applySubscription(tx, { ...state, userId: context.userId }, new Date(subscription.updatedAt)),
        );
      }
    }
    return this.summary(context);
  },

  /** Signed-in links to Paddle's customer portal: overview, card update, cancellation. */
  async portal(context: BusinessContext): Promise<{
    overview: string;
    updatePaymentMethod: string | null;
    cancel: string | null;
  }> {
    const paddle = await this.requirePaddle();
    const subscriptions = await billingRepository.subscriptionsOf(context.userId);
    const customerId = subscriptions.find((subscription) => subscription.providerCustomerId)?.providerCustomerId;
    if (!customerId) throw ApiError.conflict("There's no subscription to manage yet.");

    const live = subscriptions.filter((subscription) => subscription.status !== "CANCELED" && subscription.providerSubscriptionId);
    const session = await paddle.customerPortalSessions.create(
      customerId,
      live.map((subscription) => subscription.providerSubscriptionId!),
    );
    const current = session.urls.subscriptions[0];
    return {
      overview: session.urls.general.overview,
      updatePaymentMethod: current?.updateSubscriptionPaymentMethod ?? null,
      cancel: current?.cancelSubscription ?? null,
    };
  },

  async requirePaddle() {
    const paddle = await paddleClient();
    if (!paddle) throw new ApiError(ErrorCode.BILLING_DISABLED, "Billing isn't set up yet.");
    return paddle;
  },

  /** The reverse trial: Pro for 14 days from onboarding, then Free. Never restarted. */
  startTrial(userId: string, now: Date = new Date(), client: Client = db) {
    return client.user.updateMany({
      where: { id: userId, trialEndsAt: null },
      data: { trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000) },
    });
  },
};
