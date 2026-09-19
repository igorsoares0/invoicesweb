import { cn } from "cn";
import Link from "next/link";
import type { PlanSummaryDto } from "@/lib/api-types";
import { formatShortDate } from "@/lib/dates";

/** "Free plan", "Pro trial" or "Pro", under the business name. */
export function planLabel(plan: PlanSummaryDto): string {
  if (plan.source === "trial") return "Pro trial";
  return plan.plan === "PRO" ? "Pro" : "Free plan";
}

/** Whole days left, a partial day counting as one (the last day reads "1 day left"). */
export function daysLeft(until: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / 86_400_000));
}

/**
 * The sidebar card (design a1/b3): the month's usage on Free, the countdown during the trial,
 * nothing on Pro. At the limit it switches to the warning palette and "See Pro".
 */
export function UsageCard({ plan, now }: { plan: PlanSummaryDto; now?: Date }) {
  if (plan.source === "trial" && plan.trialEndsAt) {
    const left = daysLeft(plan.trialEndsAt, now);
    return (
      <section aria-label="Plan usage" className="rounded-lg border bg-card p-3">
        <p className="text-[12px] font-semibold">
          Pro trial · {left} {left === 1 ? "day" : "days"} left
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-2">Then free forever, three invoices a month.</p>
        <Link
          href="/pricing"
          className="mt-2.5 flex h-8 items-center justify-center rounded-md bg-foreground text-[12px] font-semibold text-white"
        >
          Keep Pro
        </Link>
      </section>
    );
  }
  if (plan.plan === "PRO" || plan.usage.limit === null) return null;

  const { sent, limit, resetsOn } = plan.usage;
  const atLimit = sent >= limit;
  // Clamped: after a downgrade the month can already be past the limit.
  const shown = Math.min(sent, limit);
  return (
    <section
      aria-label="Plan usage"
      className={cn("rounded-lg border p-3", atLimit ? "border-warning-border bg-warning-tint text-warning-ink" : "bg-card")}
    >
      <p className="text-[12px] font-semibold">
        {shown} of {limit} invoices sent
      </p>
      <p className={cn("mt-0.5 text-[11.5px]", atLimit ? "text-warning-ink" : "text-muted-2")}>
        Resets {formatShortDate(resetsOn)}
      </p>
      <div
        className="mt-2 h-[5px] overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Invoices sent this month"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={shown}
      >
        <div
          className={cn("h-full rounded-full", atLimit ? "bg-warning" : "bg-primary")}
          style={{ width: `${(shown / limit) * 100}%` }}
        />
      </div>
      <Link
        href="/pricing"
        className="mt-2.5 flex h-8 items-center justify-center rounded-md bg-foreground text-[12px] font-semibold text-white"
      >
        {atLimit ? "See Pro" : "Upgrade to Pro"}
      </Link>
    </section>
  );
}
