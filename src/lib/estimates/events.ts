import { describeRecipients, type EventTone } from "@/lib/invoices/events";

export interface EstimateEventLike {
  type: string;
  metadata: Record<string, unknown> | null;
}

function emailedLabel(event: EstimateEventLike): string {
  const recipients = describeRecipients(event.metadata);
  return recipients ? `Emailed to ${recipients}` : "Emailed";
}

/** One line of an estimate's status timeline (design c2). */
export function describeEstimateEvent(event: EstimateEventLike): { label: string; tone: EventTone } {
  const byYou = event.metadata?.by === "you";
  switch (event.type) {
    case "CREATED":
      return { label: "Created", tone: "muted" };
    case "SENT":
      return event.metadata?.channel === "email"
        ? { label: emailedLabel(event), tone: "info" }
        : { label: "Marked as sent", tone: "info" };
    case "EMAIL_SENT":
      return { label: emailedLabel(event), tone: "info" };
    case "EMAIL_FAILED":
      return {
        label: typeof event.metadata?.reason === "string" ? `Email failed — ${event.metadata.reason}` : "Email failed",
        tone: "danger",
      };
    case "VIEWED":
      return { label: "Viewed by client", tone: "info" };
    case "ACCEPTED":
      return { label: byYou ? "Marked accepted by you" : "Accepted by client", tone: "success" };
    case "DECLINED":
      return { label: byYou ? "Marked declined by you" : "Declined by client", tone: "danger" };
    case "REOPENED":
      return { label: "Reopened for a reply", tone: "neutral" };
    case "CONVERTED":
      return {
        label: typeof event.metadata?.invoiceNumber === "string" ? `Converted to ${event.metadata.invoiceNumber}` : "Converted",
        tone: "success",
      };
    case "LINK_REVOKED":
      return { label: "Public link revoked", tone: "neutral" };
    case "DUPLICATED":
      return {
        label: typeof event.metadata?.fromNumber === "string" ? `Duplicated from ${event.metadata.fromNumber}` : "Duplicated",
        tone: "muted",
      };
    default:
      return { label: "Updated", tone: "muted" };
  }
}
