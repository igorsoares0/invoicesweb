import type { IsoDate } from "@/lib/dates";

export const ESTIMATE_STATUSES = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "CONVERTED"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

/** What people see: the stored status, or EXPIRED when a reply is still pending past the expiry date. */
export type DisplayEstimateStatus = EstimateStatus | "EXPIRED";

/** Statuses waiting for the client's answer. */
export const AWAITING_REPLY = ["SENT", "VIEWED"] as const satisfies readonly EstimateStatus[];

export function isAwaitingReply(status: EstimateStatus): boolean {
  return (AWAITING_REPLY as readonly EstimateStatus[]).includes(status);
}

export function isExpired(estimate: { status: EstimateStatus; expiryDate: IsoDate }, today: IsoDate): boolean {
  return isAwaitingReply(estimate.status) && estimate.expiryDate < today;
}

export function displayEstimateStatus(
  estimate: { status: EstimateStatus; expiryDate: IsoDate },
  today: IsoDate,
): DisplayEstimateStatus {
  return isExpired(estimate, today) ? "EXPIRED" : estimate.status;
}

export type EstimateAction =
  | "edit"
  | "delete"
  | "send"
  | "email"
  | "accept"
  | "decline"
  | "reopen"
  | "convert"
  | "markViewed"
  | "revokeLink"
  | "createLink";

export function canPerformEstimate(
  estimate: { status: EstimateStatus; expiryDate: IsoDate; convertedInvoiceId?: string | null },
  action: EstimateAction,
  today: IsoDate,
): boolean {
  const { status } = estimate;
  const expired = estimate.expiryDate < today;
  switch (action) {
    case "edit":
    case "delete":
    case "send":
      return status === "DRAFT";
    case "email":
      // Converted estimates live on as an invoice, and an expired one can no longer be answered.
      return status !== "CONVERTED" && !(isAwaitingReply(status) && expired);
    case "accept":
    case "decline":
      return isAwaitingReply(status) && !expired;
    case "reopen":
      // A declined estimate can be put back in front of the client while it's still valid.
      return status === "DECLINED" && !expired;
    case "convert":
      // Converted but the resulting draft was deleted: allow converting again.
      return status === "ACCEPTED" || (status === "CONVERTED" && !estimate.convertedInvoiceId);
    case "markViewed":
      return status === "SENT";
    case "revokeLink":
    case "createLink":
      return status !== "DRAFT";
  }
}

export const ESTIMATE_STATUS_LABELS: Record<DisplayEstimateStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CONVERTED: "Converted",
  EXPIRED: "Expired",
};
