"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { daysLeft, UsageCard } from "@/features/billing/usage-card";
import { usePlan } from "@/features/billing/plan-context";
import { api, ApiClientError } from "@/lib/api-client";
import type { PlanSummaryDto } from "@/lib/api-types";
import { SettingsCard } from "./settings-card";

type PortalLinks = { overview: string; updatePaymentMethod: string | null; cancel: string | null };

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border px-4 py-3">
      <span className="text-[12px] text-muted-2">{label}</span>
      <span className="text-[15px] font-semibold">{value}</span>
      {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/**
 * Settings → Plan & billing (design f4, adapted). Card, receipts and cancellation live in
 * Paddle's customer portal; this card says where things stand and links there.
 */
export function BillingSection({ plan: fallback }: { plan: PlanSummaryDto }) {
  const plan = usePlan()?.plan ?? fallback;
  const [pending, setPending] = useState<keyof PortalLinks | null>(null);

  async function openPortal(link: keyof PortalLinks) {
    setPending(link);
    try {
      const links = await api.post<PortalLinks>("/billing/portal", {});
      window.open(links[link] ?? links.overview, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Couldn't open the billing portal");
    } finally {
      setPending(null);
    }
  }

  const price = plan.interval === "YEAR" ? "$90/yr + tax" : "$9/mo + tax";

  return (
    <SettingsCard id="billing" title="Plan & billing" description={summaryLine(plan)}>
      {plan.source === "subscription" ? (
        <div className="flex flex-col gap-4">
          {plan.status === "PAST_DUE" ? (
            <p role="alert" className="rounded-md border border-warning-border bg-warning-tint px-3 py-2.5 text-[13.5px] text-warning-ink">
              The last payment didn&apos;t go through. Paddle will try again — update your card to keep Pro.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Plan" value={plan.interval === "YEAR" ? "Pro · yearly" : "Pro · monthly"} />
            {plan.cancelAtPeriodEnd && plan.currentPeriodEnd ? (
              <Fact label="Pro until" value={formatDay(plan.currentPeriodEnd)} hint="Then back to Free. Nothing sent changes." />
            ) : (
              <Fact
                label="Next charge"
                value={plan.nextBilledAt ? formatDay(plan.nextBilledAt) : "—"}
                hint={price}
              />
            )}
            <Fact label="Invoices this month" value={String(plan.usage.sent)} hint="No limit on Pro" />
          </div>
          {plan.canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="lg" disabled={pending !== null} onClick={() => openPortal("overview")}>
                Manage subscription
              </Button>
              <Button variant="outline" size="lg" disabled={pending !== null} onClick={() => openPortal("updatePaymentMethod")}>
                Update payment method
              </Button>
              {!plan.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="ml-auto text-[13.5px] font-semibold text-destructive disabled:opacity-50"
                  disabled={pending !== null}
                  onClick={() => openPortal("cancel")}
                >
                  Cancel subscription
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="text-[12.5px] text-muted-foreground">
            Receipts and payment details are in Paddle&apos;s portal. Paddle is the merchant of record and handles VAT.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="sm:w-[260px]">
            <UsageCard plan={plan} />
          </div>
          <div className="flex flex-col gap-2 text-[14px]">
            <p className="text-muted-foreground">
              Pro removes the monthly limit, unlocks all five templates and your accent colour, and drops the
              &ldquo;Made with&rdquo; mark. $9 a month, or $90 a year.
            </p>
            <Link href="/pricing" className={buttonVariants({ size: "lg", className: "self-start" })}>
              {plan.source === "trial" ? "Keep Pro" : "See plans"}
            </Link>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

function summaryLine(plan: PlanSummaryDto): string {
  if (plan.source === "subscription") {
    if (plan.cancelAtPeriodEnd) return "Your Pro subscription is canceled and ends with the current period.";
    return `You're on Pro, renewing ${plan.interval === "YEAR" ? "yearly" : "monthly"}.`;
  }
  if (plan.source === "trial" && plan.trialEndsAt) {
    const left = daysLeft(plan.trialEndsAt);
    return `You're on the Pro trial — ${left} ${left === 1 ? "day" : "days"} left, then Free.`;
  }
  return "You're on the free plan.";
}
