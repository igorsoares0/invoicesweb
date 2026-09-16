import { cn } from "cn";
import type { DisplayInvoiceStatus } from "@/lib/api-types";
import { STATUS_LABELS } from "@/lib/invoices/status";

const TONES: Record<DisplayInvoiceStatus, string> = {
  DRAFT: "bg-divider text-ink-3",
  SENT: "bg-primary-tint text-primary",
  VIEWED: "bg-[#eef2ff] text-[#4338ca]",
  PARTIALLY_PAID: "bg-warning-tint text-warning",
  PAID: "bg-success-tint text-success",
  OVERDUE: "bg-danger-tint text-destructive",
  CANCELLED: "bg-[#fafafa] text-muted-foreground line-through decoration-1",
};

export function InvoiceStatusBadge({ status, className }: { status: DisplayInvoiceStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap",
        TONES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
