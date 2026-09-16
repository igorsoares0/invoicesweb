import type { InvoiceEventDto } from "@/lib/api-types";
import { formatMoney } from "@/lib/money";

export type EventTone = "success" | "info" | "neutral" | "muted" | "danger";

/** One line of the invoice History (design b3). */
export function describeEvent(event: InvoiceEventDto, currency: string): { label: string; tone: EventTone } {
  const amount = typeof event.metadata?.amount === "string" ? formatMoney(event.metadata.amount, currency) : null;
  switch (event.type) {
    case "CREATED":
      return { label: "Created — number assigned", tone: "muted" };
    case "SENT":
      return { label: "Marked as sent", tone: "neutral" };
    case "VIEWED":
      return { label: "Viewed by client", tone: "info" };
    case "PAYMENT_ADDED":
      return { label: amount ? `Payment added — ${amount}` : "Payment added", tone: "success" };
    case "PAYMENT_REMOVED":
      return { label: amount ? `Payment removed — ${amount}` : "Payment removed", tone: "danger" };
    case "CANCELLED":
      return { label: "Cancelled — public link disabled", tone: "danger" };
    case "LINK_REVOKED":
      return { label: "Public link revoked", tone: "neutral" };
    case "DUPLICATED":
      return {
        label: typeof event.metadata?.fromNumber === "string" ? `Duplicated from ${event.metadata.fromNumber}` : "Duplicated",
        tone: "muted",
      };
    default:
      return { label: "Edited", tone: "muted" };
  }
}
