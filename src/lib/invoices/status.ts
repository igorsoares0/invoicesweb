import type { IsoDate } from "@/lib/dates";
import { compareMoney } from "./math";

export const INVOICE_STATUSES = ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** What people see: the stored status, or OVERDUE when an open invoice is past its due date. */
export type DisplayStatus = InvoiceStatus | "OVERDUE";

/** Statuses that still expect money. */
export const OPEN_STATUSES = ["SENT", "VIEWED", "PARTIALLY_PAID"] as const satisfies readonly InvoiceStatus[];

export function isOpen(status: InvoiceStatus): boolean {
  return (OPEN_STATUSES as readonly InvoiceStatus[]).includes(status);
}

export function displayStatus(
  invoice: { status: InvoiceStatus; dueDate: IsoDate; amountDue: string },
  today: IsoDate,
): DisplayStatus {
  if (isOpen(invoice.status) && invoice.dueDate < today && compareMoney(invoice.amountDue, "0") > 0) {
    return "OVERDUE";
  }
  return invoice.status;
}

export type InvoiceAction =
  | "edit"
  | "delete"
  | "send"
  | "recordPayment"
  | "removePayment"
  | "cancel"
  | "markViewed"
  | "revokeLink";

const ALLOWED: Record<InvoiceAction, readonly InvoiceStatus[]> = {
  edit: ["DRAFT"],
  delete: ["DRAFT"],
  send: ["DRAFT"],
  recordPayment: ["SENT", "VIEWED", "PARTIALLY_PAID"],
  removePayment: ["PARTIALLY_PAID", "PAID"],
  // Once money has come in, cancelling would hide it; refunds are out of scope for the MVP.
  cancel: ["DRAFT", "SENT", "VIEWED"],
  markViewed: ["SENT"],
  revokeLink: ["SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "CANCELLED"],
};

export function canPerform(status: InvoiceStatus, action: InvoiceAction): boolean {
  return ALLOWED[action].includes(status);
}

/**
 * Status after the amount paid changes. With nothing paid the invoice falls back to where
 * it was before any payment: VIEWED if the client ever opened it, otherwise SENT.
 */
export function statusAfterPayment(total: string, amountPaid: string, wasViewed: boolean): InvoiceStatus {
  if (compareMoney(amountPaid, "0") <= 0) return wasViewed ? "VIEWED" : "SENT";
  return compareMoney(amountPaid, total) >= 0 ? "PAID" : "PARTIALLY_PAID";
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
};
