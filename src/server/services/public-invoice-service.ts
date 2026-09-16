import "server-only";
import type { InvoiceDto } from "@/lib/api-types";
import { daysBetween, todayIn } from "@/lib/dates";
import type { InvoiceView } from "@/lib/documents/view";
import { isZero } from "@/lib/invoices/math";
import { db } from "@/server/db";
import { documentParties, invoiceViewFrom, renderInvoicePdf } from "@/server/invoices/document";
import { PUBLIC_TOKEN_PATTERN } from "@/server/invoices/public-token";
import { toInvoiceDto } from "@/server/invoices/serializers";
import { invoiceRepository, type InvoiceDetail } from "@/server/repositories/invoice-repository";

export type PublicTone = "sent" | "partial" | "paid" | "overdue";

/** Only what a client needs to see (spec §64): no internal ids, events or payment details. */
export interface PublicInvoice {
  number: string;
  template: InvoiceDto["template"];
  view: InvoiceView;
  status: { label: string; tone: PublicTone };
  /** "Due in 14 days", "Due today", "Overdue by 3 days", "Paid in full" */
  dueLabel: string;
  issuerName: string;
  issuerEmail: string | null;
}

async function load(token: string): Promise<{ detail: InvoiceDetail; dto: InvoiceDto; today: string } | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return null;
  const detail = await invoiceRepository.findByPublicToken(token);
  // Cancelling clears the token too; the status check is a second lock on the door.
  if (!detail || detail.status === "DRAFT" || detail.status === "CANCELLED") return null;
  const business = await db.business.findUniqueOrThrow({ where: { id: detail.businessId }, select: { timezone: true } });
  const today = todayIn(business.timezone);
  return { detail, dto: toInvoiceDto(detail, today), today };
}

function describe(dto: InvoiceDto, today: string): Pick<PublicInvoice, "status" | "dueLabel"> {
  if (dto.status === "PAID" || isZero(dto.amountDue)) {
    return { status: { label: "Paid", tone: "paid" }, dueLabel: "Paid in full" };
  }
  const days = daysBetween(today, dto.dueDate);
  if (days < 0) {
    const late = -days;
    return { status: { label: "Overdue", tone: "overdue" }, dueLabel: `Overdue by ${late} day${late === 1 ? "" : "s"}` };
  }
  const status =
    dto.status === "PARTIALLY_PAID"
      ? { label: "Partially paid", tone: "partial" as const }
      : { label: "Invoice sent", tone: "sent" as const };
  const dueLabel = days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`;
  return { status, dueLabel };
}

export const publicInvoiceService = {
  async find(token: string): Promise<PublicInvoice | null> {
    const found = await load(token);
    if (!found) return null;
    const { detail, dto, today } = found;
    const parties = await documentParties(detail);
    return {
      number: dto.number,
      template: dto.template,
      view: invoiceViewFrom(dto, parties),
      ...describe(dto, today),
      issuerName: parties.issuer.name,
      issuerEmail: parties.issuer.email,
    };
  },

  /**
   * Records the client's first visit: SENT becomes VIEWED and the history gets one VIEWED event.
   * Visits by the invoice's own business don't count.
   */
  async recordView(token: string, viewerUserId: string | null): Promise<void> {
    const found = await load(token);
    if (!found) return;
    const { detail } = found;
    if (viewerUserId) {
      const owner = await db.business.findFirst({ where: { id: detail.businessId, userId: viewerUserId }, select: { id: true } });
      if (owner) return;
    }
    await db.$transaction(async (tx) => {
      const claimed = await tx.invoice.updateMany({
        where: { id: detail.id, viewedAt: null },
        data: { viewedAt: new Date() },
      });
      if (claimed.count === 0) return;
      await tx.invoice.updateMany({ where: { id: detail.id, status: "SENT" }, data: { status: "VIEWED" } });
      await invoiceRepository.addEvent(tx, detail.id, "VIEWED");
    });
  },

  async pdf(token: string): Promise<{ pdf: Buffer; number: string } | null> {
    const invoice = await this.find(token);
    if (!invoice) return null;
    return { pdf: await renderInvoicePdf(invoice.view, invoice.template), number: invoice.number };
  },
};
