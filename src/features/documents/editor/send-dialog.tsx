"use client";

import { useState } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatShortDate } from "@/lib/dates";
import type { DocumentKind } from "@/lib/documents/view";
import { formatMoney } from "@/lib/money";

/**
 * Email sending arrives in a later phase; for now "sending" marks the invoice as sent and
 * publishes its link for the user to share.
 */
export function SendDialog({
  open,
  onOpenChange,
  number,
  total,
  currency,
  endDate,
  kind,
  clientEmail,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: string;
  total: string;
  currency: string;
  endDate: string;
  kind: DocumentKind;
  clientEmail: string | null;
  onConfirm: () => Promise<string | null>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[17px] font-semibold">{kind === "estimate" ? "Send estimate" : "Send invoice"}</DialogTitle>
          <DialogDescription>
            {number} · {formatMoney(total, currency)} · {kind === "estimate" ? "valid until" : "due"} {formatShortDate(endDate)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 pb-5 text-[14px]">
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          <p>
            Marking the {kind} as sent publishes a private link you can share with{" "}
            <strong className="font-semibold">{clientEmail ?? "your client"}</strong>. They can view it
            {kind === "estimate" ? ", accept or decline it," : " and download the PDF"} without an account.
          </p>
          <p className="rounded-md bg-canvas-2 px-3 py-2 text-[13px] text-muted-foreground">
            Sending by email from Invoice Maker is coming soon. Until then, copy the link after sending.
          </p>
        </div>
        <DialogFooter className="flex-col items-stretch gap-3 rounded-b-xl border-t bg-canvas-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-muted-foreground">
            The number <strong className="font-mono font-semibold text-foreground">{number}</strong> is already assigned. On
            send the status becomes Sent.
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" size="lg" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                const problem = await onConfirm();
                setPending(false);
                if (problem) setError(problem);
              }}
            >
              {pending ? "Sending…" : "Mark as sent"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
