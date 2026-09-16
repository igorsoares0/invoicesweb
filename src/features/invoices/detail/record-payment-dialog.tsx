"use client";

import { cn } from "cn";
import { useState, type FormEvent } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api-client";
import type { InvoiceDto, PaymentMethod } from "@/lib/api-types";
import { currencySymbol } from "@/lib/currencies";
import { parseMoneyInput } from "@/lib/invoices/line-text";
import { compareMoney, subtractMoney } from "@/lib/invoices/math";
import { formatAmount, formatMoney } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/validation/invoice";

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  PAYPAL: "PayPal",
  OTHER: "Other",
};

const METHOD_ORDER: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "PAYPAL", "OTHER"];

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  clientName,
  today,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDto;
  clientName: string | null;
  today: string;
  onRecorded: (invoice: InvoiceDto) => void;
}) {
  const { error, pending, submit } = useApiForm();
  const [amount, setAmount] = useState(formatAmount(invoice.amountDue));
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  // One key per dialog, so a double click or a retry never records the payment twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const parsed = parseMoneyInput(amount);
  const outcome =
    parsed === null || compareMoney(parsed, "0") <= 0
      ? null
      : compareMoney(parsed, invoice.amountDue) > 0
        ? { tone: "danger", text: `That's more than the ${formatMoney(invoice.amountDue, invoice.currency)} still open.` }
        : compareMoney(parsed, invoice.amountDue) === 0
          ? { tone: "success", text: "This closes the balance — status becomes Paid." }
          : {
              tone: "warning",
              text: `Leaves ${formatMoney(subtractMoney(invoice.amountDue, parsed), invoice.currency)} open — status becomes Partially paid.`,
            };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const updated = await submit(() =>
      api.post<InvoiceDto>(
        `/invoices/${invoice.id}/payments`,
        { amount: parsed ?? amount, paymentDate, method, reference },
        { headers: { "idempotency-key": idempotencyKey } },
      ),
    );
    if (updated) onRecorded(updated);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[456px]">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold">Record payment</DialogTitle>
          <DialogDescription>
            {[invoice.number, clientName, `${formatMoney(invoice.amountDue, invoice.currency)} open`].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}
          <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
            <div>
              <Label htmlFor="payment-amount" className="mb-1.5">
                Amount
              </Label>
              <div className="flex h-[42px] overflow-hidden rounded-md border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/12">
                <span className="flex items-center border-r bg-canvas-2 px-3 text-[13px] text-muted-2">
                  {invoice.currency} {currencySymbol(invoice.currency)}
                </span>
                <input
                  id="payment-amount"
                  inputMode="decimal"
                  autoFocus
                  className="w-full min-w-0 bg-transparent px-3 text-[15px] font-semibold outline-none"
                  value={amount}
                  aria-invalid={error("amount") ? true : undefined}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              {error("amount") ? <p className="mt-1 text-[12.5px] text-destructive">{error("amount")}</p> : null}
            </div>
            <div>
              <Label htmlFor="payment-date" className="mb-1.5">
                Date
              </Label>
              <Input id="payment-date" type="date" className="h-[42px]" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              {error("paymentDate") ? <p className="mt-1 text-[12.5px] text-destructive">{error("paymentDate")}</p> : null}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-2" id="payment-method">
              Method
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="payment-method">
              {METHOD_ORDER.filter((value) => PAYMENT_METHODS.includes(value)).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "h-9 rounded-md border px-3 text-[13px]",
                    method === value ? "border-foreground bg-foreground font-semibold text-white" : "bg-card hover:bg-divider",
                  )}
                >
                  {METHOD_LABELS[value]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="payment-reference" className="mb-1.5">
              Reference (optional)
            </Label>
            <Input id="payment-reference" placeholder="TRF-…" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          {outcome ? (
            <p
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px]",
                outcome.tone === "success" && "bg-success-tint text-success-ink",
                outcome.tone === "warning" && "bg-warning-tint text-[#92400e]",
                outcome.tone === "danger" && "bg-danger-tint text-danger-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  outcome.tone === "success" ? "bg-success" : outcome.tone === "warning" ? "bg-warning" : "bg-destructive",
                )}
              />
              {outcome.text}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
