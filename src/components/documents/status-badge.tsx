import { cn } from "cn";
import type { DisplayEstimateStatus, DisplayInvoiceStatus } from "@/lib/api-types";
import { ESTIMATE_STATUS_LABELS } from "@/lib/estimates/status";
import { STATUS_LABELS } from "@/lib/invoices/status";

type Status = DisplayInvoiceStatus | DisplayEstimateStatus;

// Background / text pairs from the design tokens (README "Status badge pairs").
const TONES: Record<Status, string> = {
  DRAFT: "bg-divider text-ink-3",
  SENT: "bg-primary-tint text-primary",
  VIEWED: "bg-[#eef2ff] text-[#4338ca]",
  PARTIALLY_PAID: "bg-warning-tint text-warning",
  PAID: "bg-success-tint text-success",
  OVERDUE: "bg-danger-tint text-destructive",
  CANCELLED: "bg-[#fafafa] text-muted-foreground line-through decoration-1",
  ACCEPTED: "bg-success-tint text-success",
  DECLINED: "bg-danger-tint text-destructive",
  EXPIRED: "bg-[#fafafa] text-muted-foreground",
  CONVERTED: "bg-[#f5f3ff] text-[#6d28d9]",
};

const LABELS: Record<Status, string> = { ...ESTIMATE_STATUS_LABELS, ...STATUS_LABELS };

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap",
        TONES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
