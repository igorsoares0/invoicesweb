"use client";

import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BillingInterval, PlanSummaryDto } from "@/lib/api-types";
import { usePlan } from "./plan-context";
import { usePaddleCheckout } from "./use-paddle-checkout";

const PRICES: Record<BillingInterval, { amount: string; per: string; note: string }> = {
  MONTH: { amount: "$9", per: "/month", note: "Billed monthly" },
  YEAR: { amount: "$7.50", per: "/month", note: "$90 billed yearly" },
};

const COMPARE: [string, string, string][] = [
  ["Invoices per month", "3", "Unlimited"],
  ["Estimates", "Unlimited", "Unlimited"],
  ["PDF templates", "2", "All 5"],
  ["Custom accent color", "—", "Yes"],
  ["“Made with Invoice Maker” mark", "On documents", "None"],
  ["Clients and catalog items", "Unlimited", "Unlimited"],
  ["Public invoice link and PDF", "Yes", "Yes"],
];

function Feature({ children, pro }: { children: string; pro?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-[14px]">
      <span
        className={cn(
          "flex size-[18px] items-center justify-center rounded-full",
          pro ? "bg-primary-tint text-primary" : "bg-divider text-muted-2",
        )}
      >
        <CheckIcon className="size-3" strokeWidth={2.5} />
      </span>
      {children}
    </li>
  );
}

function CurrentPlan() {
  return (
    <p className="flex h-10 items-center justify-center rounded-md border bg-canvas-2 text-[14px] font-medium text-muted-foreground">
      Your current plan
    </p>
  );
}

/** The pricing screen (design f3): one paid plan, monthly or yearly. */
export function Pricing({ plan: fallback }: { plan: PlanSummaryDto }) {
  const planContext = usePlan();
  const plan = planContext?.plan ?? fallback;
  const [interval, setBillingInterval] = useState<BillingInterval>("YEAR");
  const checkout = usePaddleCheckout();
  const onPaidPro = plan.source === "subscription";
  const price = PRICES[interval];

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-7 px-4 py-8 sm:py-12">
      <header className="text-center">
        <h1 className="text-[27px] font-semibold tracking-[-0.01em]">One price, everything unlocked</h1>
        <p className="mx-auto mt-2 max-w-[440px] text-[15px] text-muted-foreground">
          Start free for as long as you like. Upgrade when three invoices a month stops being enough.
        </p>
      </header>

      <div role="radiogroup" aria-label="Billing period" className="flex rounded-lg border bg-card p-1">
        {(["MONTH", "YEAR"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={interval === option}
            onClick={() => setBillingInterval(option)}
            className={cn(
              "h-8 rounded-md px-4 text-[13.5px] font-semibold",
              interval === option ? "bg-foreground text-white" : "text-ink-3 hover:bg-divider",
            )}
          >
            {option === "MONTH" ? (
              "Monthly"
            ) : (
              <>
                Yearly <span className={interval === option ? "text-green-300" : "text-success"}>· 2 months free</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <section aria-label="Free" className="flex flex-col rounded-xl border bg-card p-6">
          <h2 className="text-[16px] font-semibold">Free</h2>
          <p className="text-[14px] text-muted-foreground">For the occasional invoice.</p>
          <p className="mt-4">
            <span className="text-[32px] font-bold">$0</span>
            <span className="text-[14px] text-muted-foreground">/month</span>
          </p>
          <ul className="mt-4 flex flex-1 flex-col gap-2.5">
            <Feature>3 invoices per month</Feature>
            <Feature>Unlimited estimates</Feature>
            <Feature>2 PDF templates</Feature>
            <Feature>Unlimited clients and items</Feature>
            <Feature>Public link and PDF download</Feature>
          </ul>
          <div className="mt-6">{plan.plan === "FREE" ? <CurrentPlan /> : null}</div>
        </section>

        <section aria-label="Pro" className="flex flex-col rounded-xl border-2 border-primary bg-card p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold">Pro</h2>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white uppercase">
              Most picked
            </span>
          </div>
          <p className="text-[14px] text-muted-foreground">For anyone billing every week.</p>
          <p className="mt-4">
            <span className="text-[32px] font-bold">{price.amount}</span>
            <span className="text-[14px] text-muted-foreground">{price.per}</span>
          </p>
          <p className="text-[12.5px] text-muted-2">{price.note}, plus tax where it applies</p>
          <ul className="mt-4 flex flex-1 flex-col gap-2.5">
            <Feature pro>Unlimited invoices</Feature>
            <Feature pro>All 5 templates</Feature>
            <Feature pro>Your accent color</Feature>
            <Feature pro>{"No “Made with” mark"}</Feature>
          </ul>
          <div className="mt-6">
            {onPaidPro ? (
              <>
                <CurrentPlan />
                <Link
                  href="/settings#billing"
                  className="mt-2 block text-center text-[13px] font-medium text-primary hover:underline"
                >
                  Manage subscription
                </Link>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-10 w-full"
                  disabled={checkout.state !== "idle"}
                  onClick={() => checkout.open(interval)}
                >
                  {checkout.state === "activating"
                    ? "Activating Pro…"
                    : checkout.state === "opening"
                      ? "Opening checkout…"
                      : plan.source === "trial"
                        ? "Keep Pro after the trial"
                        : "Upgrade to Pro"}
                </Button>
                <p className="mt-2 text-center text-[12.5px] text-muted-foreground">
                  Cancel any time · handled by Paddle
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[480px] text-[14px]">
          <thead>
            <tr className="border-b bg-canvas-2 text-left text-[11.5px] font-semibold tracking-wide text-muted-2 uppercase">
              <th className="px-5 py-3 font-semibold">Compare</th>
              <th className="w-[130px] px-5 py-3 text-center font-semibold">Free</th>
              <th className="w-[130px] px-5 py-3 text-center font-semibold">Pro</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([label, free, pro]) => (
              <tr key={label} className="border-b last:border-b-0">
                <td className="px-5 py-3">{label}</td>
                <td className="px-5 py-3 text-center text-muted-foreground">{free}</td>
                <td className="px-5 py-3 text-center font-semibold">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!checkout.available ? (
        <p className="text-center text-[12.5px] text-muted-foreground">
          Billing isn&apos;t configured on this server, so checkout is unavailable.
        </p>
      ) : null}
    </div>
  );
}
