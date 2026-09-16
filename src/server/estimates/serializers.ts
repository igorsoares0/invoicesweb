import type { Estimate } from "@/generated/prisma/client";
import type { EstimateDto, EstimateListItemDto } from "@/lib/api-types";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { findIssueProblems } from "@/lib/documents/issues";
import { displayEstimateStatus } from "@/lib/estimates/status";
import { toItemDto } from "@/server/invoices/serializers";
import type { EstimateDetail } from "@/server/repositories/estimate-repository";

const money = (value: { toFixed(digits: number): string }) => value.toFixed(2);

function baseFields(estimate: Estimate, today: IsoDate) {
  const expiryDate = toIsoDate(estimate.expiryDate);
  return {
    id: estimate.id,
    number: estimate.number,
    status: estimate.status,
    displayStatus: displayEstimateStatus({ status: estimate.status, expiryDate }, today),
    issueDate: toIsoDate(estimate.issueDate),
    expiryDate,
    currency: estimate.currency,
    total: money(estimate.total),
    acceptedAt: estimate.acceptedAt?.toISOString() ?? null,
    createdAt: estimate.createdAt.toISOString(),
  };
}

export function toEstimateListItemDto(
  estimate: Estimate & { client: { id: string; name: string } | null; items: { description: string }[] },
  today: IsoDate,
): EstimateListItemDto {
  return { ...baseFields(estimate, today), client: estimate.client, summary: estimate.items[0]?.description || null };
}

export function toEstimateDto(estimate: EstimateDetail, today: IsoDate): EstimateDto {
  const items = estimate.items.map(toItemDto);
  const base = baseFields(estimate, today);
  return {
    ...base,
    sequence: estimate.sequence,
    client: estimate.client
      ? {
          id: estimate.client.id,
          name: estimate.client.name,
          email: estimate.client.email,
          deleted: estimate.client.deletedAt !== null,
        }
      : null,
    subtotal: money(estimate.subtotal),
    discount: money(estimate.discount),
    tax: money(estimate.tax),
    notes: estimate.notes,
    terms: estimate.terms,
    template: estimate.template,
    color: estimate.color,
    publicToken: estimate.publicToken,
    sentAt: estimate.sentAt?.toISOString() ?? null,
    viewedAt: estimate.viewedAt?.toISOString() ?? null,
    declinedAt: estimate.declinedAt?.toISOString() ?? null,
    convertedAt: estimate.convertedAt?.toISOString() ?? null,
    respondedBy: estimate.respondedBy === "client" || estimate.respondedBy === "you" ? estimate.respondedBy : null,
    convertedInvoice: estimate.convertedInvoice,
    items,
    events: estimate.events.map((event) => ({
      id: event.id,
      type: event.type,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    issues:
      estimate.status === "DRAFT"
        ? findIssueProblems(
            { clientId: estimate.clientId, issueDate: base.issueDate, endDate: base.expiryDate, items },
            { endPath: "expiryDate", endLabel: "Expiry date" },
          )
        : [],
    updatedAt: estimate.updatedAt.toISOString(),
  };
}
