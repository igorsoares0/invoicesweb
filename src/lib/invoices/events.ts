import type { InvoiceEventDto } from "@/lib/api-types";
import { formatMoney } from "@/lib/money";

export type EventTone = "success" | "info" | "neutral" | "muted" | "danger";

/** "Emailed to billing@pineco.com +2" — one line, however many recipients (design b3). */
export function describeRecipients(metadata: Record<string, unknown> | null | undefined): string | null {
  const to = Array.isArray(metadata?.to) ? metadata.to.filter((value): value is string => typeof value === "string") : [];
  if (!to.length) return null;
  return to.length === 1 ? to[0] : `${to[0]} +${to.length - 1}`;
}

function emailedLabel(event: InvoiceEventDto): string {
  const recipients = describeRecipients(event.metadata);
  return recipients ? `Emailed to ${recipients}` : "Emailed";
}

/** One line of the invoice History (design b3). */
export function describeEvent(event: InvoiceEventDto, currency: string): { label: string; tone: EventTone } {
  const amount = typeof event.metadata?.amount === "string" ? formatMoney(event.metadata.amount, currency) : null;
  switch (event.type) {
    case "CREATED":
      return { label: "Created — number assigned", tone: "muted" };
    case "SENT":
      // The same action, two channels: an email, or publishing the link to share by hand.
      return event.metadata?.channel === "email"
        ? { label: emailedLabel(event), tone: "neutral" }
        : { label: "Marked as sent", tone: "neutral" };
    case "EMAIL_SENT":
      return { label: emailedLabel(event), tone: "neutral" };
    case "EMAIL_FAILED":
      return {
        label: typeof event.metadata?.reason === "string" ? `Email failed — ${event.metadata.reason}` : "Email failed",
        tone: "danger",
      };
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
    case "UPDATED":
      return { label: "Edited", tone: "muted" };
    // Estimate-only types share the DTO union; they never reach an invoice timeline.
    case "ACCEPTED":
    case "DECLINED":
    case "REOPENED":
    case "CONVERTED":
      return { label: "Edited", tone: "muted" };
  }
}
