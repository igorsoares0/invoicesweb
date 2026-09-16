import "server-only";
import type { EstimateDto } from "@/lib/api-types";
import { daysBetween, formatLongDate, todayIn } from "@/lib/dates";
import type { DocumentView } from "@/lib/documents/view";
import { ApiError, ErrorCode } from "@/server/api/errors";
import { db } from "@/server/db";
import { ESTIMATE_TOKEN_PATTERN } from "@/server/documents/public-token";
import { documentParties, estimateViewFrom, renderDocumentPdf } from "@/server/documents/render";
import { toEstimateDto } from "@/server/estimates/serializers";
import { estimateRepository, type EstimateDetail } from "@/server/repositories/estimate-repository";
import { estimateService } from "./estimate-service";

export type PublicEstimateState = "awaiting" | "accepted" | "declined" | "expired";

/** What the client sees: the document and whether a decision is still possible. */
export interface PublicEstimate {
  number: string;
  template: EstimateDto["template"];
  view: DocumentView;
  state: PublicEstimateState;
  /** "Expires in 14 days", "Expires today", "Expired on August 26, 2026", "Accepted on September 10, 2026" */
  stateLabel: string;
  validUntil: string;
  issuerName: string;
  issuerEmail: string | null;
}

async function load(token: string) {
  if (!ESTIMATE_TOKEN_PATTERN.test(token)) return null;
  const detail = await estimateRepository.findByPublicToken(token);
  if (!detail || detail.status === "DRAFT") return null;
  const business = await db.business.findUniqueOrThrow({
    where: { id: detail.businessId },
    select: { timezone: true, userId: true },
  });
  const today = todayIn(business.timezone);
  return { detail, dto: toEstimateDto(detail, today), today, ownerId: business.userId };
}

function describeState(dto: EstimateDto, today: string): Pick<PublicEstimate, "state" | "stateLabel"> {
  if (dto.status === "ACCEPTED" || dto.status === "CONVERTED") {
    return { state: "accepted", stateLabel: `Accepted on ${formatLongDate((dto.acceptedAt ?? dto.updatedAt).slice(0, 10))}` };
  }
  if (dto.status === "DECLINED") {
    return { state: "declined", stateLabel: `Declined on ${formatLongDate((dto.declinedAt ?? dto.updatedAt).slice(0, 10))}` };
  }
  if (dto.displayStatus === "EXPIRED") {
    return { state: "expired", stateLabel: `Expired on ${formatLongDate(dto.expiryDate)}` };
  }
  const days = daysBetween(today, dto.expiryDate);
  return { state: "awaiting", stateLabel: days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}` };
}

export const publicEstimateService = {
  async find(token: string): Promise<PublicEstimate | null> {
    const found = await load(token);
    if (!found) return null;
    const parties = await documentParties(found.detail);
    return {
      number: found.dto.number,
      template: found.dto.template,
      view: estimateViewFrom(found.dto, parties),
      ...describeState(found.dto, found.today),
      validUntil: formatLongDate(found.dto.expiryDate),
      issuerName: parties.issuer.name,
      issuerEmail: parties.issuer.email,
    };
  },

  /** First visit by someone other than the business: SENT becomes VIEWED, once. */
  async recordView(token: string, viewerUserId: string | null): Promise<void> {
    const found = await load(token);
    if (!found || (viewerUserId && viewerUserId === found.ownerId)) return;
    const { detail } = found;
    await db.$transaction(async (tx) => {
      const claimed = await tx.estimate.updateMany({ where: { id: detail.id, viewedAt: null }, data: { viewedAt: new Date() } });
      if (claimed.count === 0) return;
      await tx.estimate.updateMany({ where: { id: detail.id, status: "SENT" }, data: { status: "VIEWED" } });
      await estimateRepository.addEvent(tx, detail.id, "VIEWED");
    });
  },

  /** The client's decision from the public page. Unknown and revoked links get the same answer. */
  async respond(token: string, answer: "accept" | "decline"): Promise<PublicEstimate> {
    const found = await load(token);
    if (!found) throw ApiError.notFound("Estimate");
    const context = { userId: found.ownerId, businessId: found.detail.businessId };
    try {
      await estimateService.reply(context, found.detail.id, answer, "client");
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.INVALID_STATUS_TRANSITION) {
        throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, replyRefusal(found.detail, found.dto, answer));
      }
      throw error;
    }
    return (await this.find(token))!;
  },

  async pdf(token: string): Promise<{ pdf: Buffer; number: string } | null> {
    const estimate = await this.find(token);
    if (!estimate) return null;
    return { pdf: await renderDocumentPdf(estimate.view, estimate.template), number: estimate.number };
  },
};

function replyRefusal(detail: EstimateDetail, dto: EstimateDto, answer: "accept" | "decline") {
  if (dto.displayStatus === "EXPIRED") return "This estimate has expired and can no longer be answered.";
  if (detail.status === "DECLINED" && answer === "accept") return "This estimate was declined. Ask the sender for a new one.";
  if (answer === "decline") return "This estimate was already accepted.";
  return "This estimate can no longer be answered.";
}
