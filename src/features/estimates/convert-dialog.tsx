"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/status-badge";
import { ErrorBanner } from "@/components/forms/error-banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiForm } from "@/hooks/use-api-form";
import { usePlan } from "@/features/billing/plan-context";
import { gateFromError, PlanLimitDialog, type PlanGate } from "@/features/billing/plan-limit-dialog";
import { api, ApiClientError } from "@/lib/api-client";
import type { ConvertEstimateResultDto, EstimateDto } from "@/lib/api-types";
import { addDays, daysBetween, isValidIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { pluralize } from "@/lib/format";

/** Design c2 "Convert to invoice": the estimate stays untouched and is marked Converted. */
export function ConvertDialog({
  open,
  onOpenChange,
  estimate,
  clientName,
  nextInvoiceNumber,
  paymentTermsDays,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: EstimateDto;
  clientName: string | null;
  nextInvoiceNumber: string;
  paymentTermsDays: number;
  today: string;
}) {
  const router = useRouter();
  const { error, pending, submit } = useApiForm();
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, paymentTermsDays));
  const [openAfter, setOpenAfter] = useState(true);
  const [sendNow, setSendNow] = useState(false);
  const [gate, setGate] = useState<PlanGate | null>(null);
  const planContext = usePlan();
  const terms = isValidIsoDate(issueDate) && isValidIsoDate(dueDate) ? daysBetween(issueDate, dueDate) : null;

  async function convert(send = sendNow) {
    const outcome = await submit(async () => {
      try {
        const body = { issueDate, dueDate, send };
        return {
          result: await api.post<ConvertEstimateResultDto>(`/estimates/${estimate.id}/convert`, body),
        };
      } catch (error) {
        // The plan refused the send; nothing was converted. The limit dialog offers the way out.
        const refused = error instanceof ApiClientError ? gateFromError(error) : null;
        if (refused) return { refused };
        throw error;
      }
    });
    if (!outcome) return;
    if (outcome.refused) {
      await planContext?.refresh().catch(() => undefined);
      setGate(outcome.refused);
      return;
    }
    const { result } = outcome;
    if (!result) return;
    setGate(null);
    toast.success(`${result.invoice.number} created from ${estimate.number}`);
    onOpenChange(false);
    if (openAfter) router.push(`/invoices/${result.invoice.id}`);
    else router.refresh();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">Convert to invoice</DialogTitle>
            <DialogDescription>
              {estimate.number} stays untouched and is marked{" "}
              <strong className="font-semibold text-[#6d28d9]">Converted</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}
            <section className="rounded-lg border px-4 py-3 text-[13.5px]" aria-label="New invoice">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{nextInvoiceNumber}</span>
                  <StatusBadge status="DRAFT" />
                </span>
                <span className="text-[17px] font-semibold">{formatMoney(estimate.total, estimate.currency)}</span>
              </div>
              <dl className="flex flex-col gap-1">
                {[
                  ["Client", clientName ?? "—"],
                  ["Items copied", `${pluralize(estimate.items.length, "line")}, prices locked`],
                  ["Notes & terms", estimate.notes || estimate.terms ? "Carried over" : "None"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="convert-issue" className="mb-1.5">
                  Issue date
                </Label>
                <Input
                  id="convert-issue"
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                />
                {error("issueDate") ? (
                  <p className="mt-1 text-[12.5px] text-destructive">{error("issueDate")}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="convert-due" className="mb-1.5">
                  Due date{" "}
                  {terms !== null && terms >= 0 ? (
                    <span className="font-normal text-muted-2">· Net {terms}</span>
                  ) : null}
                </Label>
                <Input
                  id="convert-due"
                  type="date"
                  value={dueDate}
                  aria-invalid={error("dueDate") ? true : undefined}
                  onChange={(event) => setDueDate(event.target.value)}
                />
                {error("dueDate") ? <p className="mt-1 text-[12.5px] text-destructive">{error("dueDate")}</p> : null}
              </div>
            </div>
            <label className="flex items-center gap-2 text-[14px]">
              <Checkbox checked={openAfter} onCheckedChange={(checked) => setOpenAfter(checked === true)} />
              Open the new invoice after converting
            </label>
            <label className="flex items-center gap-2 text-[14px]">
              <Checkbox checked={sendNow} onCheckedChange={(checked) => setSendNow(checked === true)} />
              Mark it as sent right away
            </label>
            <p className="rounded-md bg-canvas-2 px-3 py-2 text-[13px] text-muted-foreground">
              The invoice gets its number <strong className="text-foreground">now</strong>, at creation — not on send.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="lg" disabled={pending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="lg" disabled={pending} onClick={() => convert()}>
                {pending ? "Creating…" : "Create invoice"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {gate ? (
        <PlanLimitDialog
          open
          gate={gate}
          plan={planContext?.plan ?? null}
          flow="convert"
          onOpenChange={(next) => {
            if (!next) setGate(null);
          }}
          onConvertWithoutSending={() => convert(false)}
        />
      ) : null}
    </>
  );
}
