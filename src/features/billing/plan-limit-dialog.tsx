"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlanSummaryDto } from "@/lib/api-types";
import type { ProOption } from "@/lib/billing/pro-options";
import { formatLongDate } from "@/lib/dates";

/** Why a send was refused: the monthly limit, or options the plan doesn't include. */
export type PlanGate = { reason: "limit" } | { reason: "pro-options"; options: ProOption[] };

const OPTION_LABELS: Record<ProOption, string> = {
  template: "a Pro template",
  color: "a custom accent colour",
};

function Check({ children }: { children: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex size-4 items-center justify-center rounded-full bg-success-tint text-success">
        <CheckIcon className="size-2.5" strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

/**
 * The gate on send (design a3). The draft is never touched: it stays as it is, and the dialog
 * offers the way through — Pro, a free version of the document, or converting without sending.
 */
export function PlanLimitDialog({
  open,
  onOpenChange,
  gate,
  plan,
  flow = "send",
  onUseFreeOptions,
  onConvertWithoutSending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate: PlanGate;
  plan: PlanSummaryDto | null;
  /** In the convert dialog there is no draft yet, so the way out is converting without sending. */
  flow?: "send" | "convert";
  onUseFreeOptions?: () => Promise<void>;
  onConvertWithoutSending?: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const limit = plan?.usage.limit ?? 3;
  const resetsOn = plan ? formatLongDate(plan.usage.resetsOn).replace(/, \d{4}$/, "") : null;

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  }

  const title =
    gate.reason === "limit" ? `You've used all ${limit} invoices this month` : "This draft uses Pro options";
  const body =
    gate.reason === "limit" ? (
      <>
        {flow === "convert" ? "The estimate is safe and nothing was converted." : "This draft is safe and stays editable."}{" "}
        Sending it needs either Pro or a wait until {resetsOn ? <strong className="font-semibold text-foreground">{resetsOn}</strong> : "next month"}.
      </>
    ) : (
      <>
        It uses {gate.options.map((option) => OPTION_LABELS[option]).join(" and ")}, which Free doesn&apos;t include.
        Switch to the free options, or keep them with Pro.
      </>
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="gap-0 p-0 sm:max-w-[470px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[17px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed">{body}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-5">
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-baseline justify-between gap-3 bg-canvas-2 px-4 py-3">
              <p className="text-[14px]">
                <span className="font-semibold">Pro</span>{" "}
                <span className="text-muted-foreground">unlimited invoices, all 5 templates, your accent colour</span>
              </p>
              <p className="shrink-0 text-[17px] font-bold">
                $9<span className="text-[12px] font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
            <ul className="flex flex-col gap-2 px-4 py-3 text-[13.5px]">
              <Check>Nothing you&apos;ve already sent changes</Check>
              <Check>Cancel any time — drafts and PDFs stay yours</Check>
            </ul>
          </div>
        </div>
        <DialogFooter className="flex-col items-stretch gap-3 rounded-b-xl border-t bg-canvas-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {flow === "convert" && onConvertWithoutSending ? (
            <button
              type="button"
              className="text-left text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={pending}
              onClick={() => run(onConvertWithoutSending)}
            >
              Convert without sending
            </button>
          ) : (
            <button
              type="button"
              className="text-left text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Keep as draft
            </button>
          )}
          <div className="flex shrink-0 justify-end gap-2">
            {gate.reason === "pro-options" && onUseFreeOptions ? (
              <button
                type="button"
                className={buttonVariants({ variant: "outline", size: "lg" })}
                disabled={pending}
                onClick={() => run(onUseFreeOptions)}
              >
                Use free options
              </button>
            ) : null}
            <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
              Upgrade to Pro
            </Link>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Maps a refused send to a gate, or null when the error is something else. */
export function gateFromError(error: { code: string; details: Record<string, string[]> }): PlanGate | null {
  if (error.code === "PLAN_LIMIT_REACHED") return { reason: "limit" };
  if (error.code === "SUBSCRIPTION_REQUIRED") {
    const options = (["template", "color"] as const).filter((option) => error.details[option]);
    return { reason: "pro-options", options: options.length ? options : ["template"] };
  }
  return null;
}
