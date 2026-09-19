import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { ApiList, InvoiceDto, InvoiceListItemDto } from "@/lib/api-types";
import { addDays, fromIsoDate, todayIn, toIsoDate } from "@/lib/dates";
import { findIssueProblems, problemsToFieldErrors } from "@/lib/documents/issues";
import { calculateTotals, subtractMoney } from "@/lib/documents/math";
import { canPerform, type InvoiceAction } from "@/lib/invoices/status";
import { formatDocumentNumber } from "@/lib/numbering";
import { toFieldErrors } from "@/lib/validation/errors";
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
} from "@/lib/validation/invoice";
import { ApiError, ErrorCode } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { db } from "@/server/db";
import { documentItemRow } from "@/server/documents/lines";
import { documentParties, invoiceViewFrom, renderDocumentPdf } from "@/server/documents/render";
import { generatePublicToken } from "@/server/documents/public-token";
import type { SendChannel } from "@/server/documents/send-channel";
import { toInvoiceDto, toInvoiceListItemDto, toItemDto, toLineInput } from "@/server/invoices/serializers";
import { billToSnapshot, issuerSnapshot } from "@/server/documents/snapshots";
import { billingRepository } from "@/server/repositories/billing-repository";
import { businessRepository } from "@/server/repositories/business-repository";
import { invoiceRepository, type InvoiceDetail, type Tx } from "@/server/repositories/invoice-repository";
import { isPrismaError } from "@/server/repositories/prisma-errors";
import { billingService } from "./billing-service";

const STATUS_MESSAGES: Record<InvoiceAction, string> = {
  edit: "Only drafts can be edited. Sent invoices keep what they were issued with.",
  delete: "Only drafts can be deleted. Cancel a sent invoice instead.",
  send: "This invoice was already sent.",
  email: "A cancelled invoice can no longer be emailed.",
  recordPayment: "Payments can only be recorded on sent invoices that still have a balance.",
  removePayment: "This invoice has no payments to remove.",
  cancel: "Invoices that already received money can't be cancelled.",
  markViewed: "This invoice can't be marked as viewed.",
  revokeLink: "This invoice has no public link.",
};

export function assertCan(invoice: { status: InvoiceDetail["status"] }, action: InvoiceAction) {
  if (!canPerform(invoice.status, action)) {
    throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, STATUS_MESSAGES[action]);
  }
}

export async function businessToday(businessId: string) {
  const business = await businessRepository.findById(businessId);
  return { business, today: todayIn(business.timezone) };
}

/** Recomputes the stored totals from the lines currently in the database. */
async function recalculate(tx: Tx, invoiceId: string) {
  const [items, invoice] = await Promise.all([
    tx.invoiceItem.findMany({ where: { invoiceId } }),
    tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { amountPaid: true } }),
  ]);
  const totals = calculateTotals(items.map((item) => toLineInput(toItemDto(item))));
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { ...totals, amountDue: subtractMoney(totals.total, invoice.amountPaid.toFixed(2)) },
  });
}

async function findOwnedClient(businessId: string, clientId: string, client: Tx | typeof db = db) {
  const found = await client.client.findFirst({ where: { id: clientId, businessId, deletedAt: null } });
  if (!found) throw ApiError.validation({ clientId: ["Client not found"] });
  return found;
}

async function loadDetail(context: BusinessContext, id: string, client: Tx | typeof db = db) {
  const invoice = await invoiceRepository.findDetail(context.businessId, id, client);
  if (!invoice) throw ApiError.notFound("Invoice");
  return invoice;
}

async function toDto(context: BusinessContext, invoice: InvoiceDetail) {
  const { today } = await businessToday(context.businessId);
  return toInvoiceDto(invoice, today);
}

export const invoiceService = {
  async list(context: BusinessContext, query: unknown): Promise<ApiList<InvoiceListItemDto>> {
    const parsed = listInvoicesQuerySchema.safeParse(query);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { today } = await businessToday(context.businessId);
    const { items, total } = await invoiceRepository.list(context.businessId, parsed.data, fromIsoDate(today));
    return {
      data: items.map((invoice) => toInvoiceListItemDto(invoice, today)),
      pagination: { page: parsed.data.page, limit: parsed.data.limit, total },
    };
  },

  async get(context: BusinessContext, id: string): Promise<InvoiceDto> {
    return toDto(context, await loadDetail(context, id));
  },

  /** Creates a draft. The number is assigned now, not when sending (a locked product decision). */
  async create(context: BusinessContext, input: unknown): Promise<InvoiceDto> {
    const parsed = createInvoiceSchema.safeParse(input ?? {});
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { business, today } = await businessToday(context.businessId);

    const client = parsed.data.clientId ? await findOwnedClient(context.businessId, parsed.data.clientId) : null;
    const productIds = parsed.data.productIds ?? [];
    const products = productIds.length
      ? await db.product.findMany({ where: { id: { in: productIds }, businessId: context.businessId, deletedAt: null } })
      : [];
    if (products.length !== new Set(productIds).size) throw ApiError.validation({ productIds: ["Item not found"] });

    const id = await db.$transaction(async (tx) => {
      const { sequence, prefix } = await invoiceRepository.reserveNumber(tx, context.businessId);
      const invoice = await tx.invoice.create({
        data: {
          businessId: context.businessId,
          clientId: client?.id ?? null,
          sequence,
          number: formatDocumentNumber(prefix, sequence),
          issueDate: fromIsoDate(today),
          dueDate: fromIsoDate(addDays(today, business.paymentTermsDays)),
          currency: client?.currency ?? business.defaultCurrency,
        },
      });
      const byId = new Map(products.map((product) => [product.id, product]));
      const rows = productIds.map((productId, position) => {
        const product = byId.get(productId)!;
        return documentItemRow(
          {
            id: randomUUID(),
            productId: product.id,
            description: product.name,
            quantity: "1",
            unitPrice: product.unitPrice.toFixed(2),
            discountType: null,
            discountValue: null,
            taxRate: product.taxRate.toFixed(2),
            taxExempt: product.taxExempt,
            taxExemptReason: product.taxExemptReason,
          },
          position,
        );
      });
      if (rows.length) {
        await tx.invoiceItem.createMany({ data: rows.map((row) => ({ ...row, invoiceId: invoice.id })) });
        await recalculate(tx, invoice.id);
      }
      await invoiceRepository.addEvent(tx, invoice.id, "CREATED", { number: invoice.number });
      return invoice.id;
    });

    return this.get(context, id);
  },

  /** Draft autosave: merges header fields and, when given, replaces every line. */
  async update(context: BusinessContext, id: string, input: unknown): Promise<InvoiceDto> {
    const parsed = updateInvoiceSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { items, clientId, ...header } = parsed.data;

    try {
      await db.$transaction(async (tx) => {
        if (!(await invoiceRepository.lock(tx, context.businessId, id))) throw ApiError.notFound("Invoice");
        const current = await tx.invoice.findUniqueOrThrow({ where: { id } });
        assertCan(current, "edit");

        if (clientId) await findOwnedClient(context.businessId, clientId, tx);
        if (items) {
          const productIds = [...new Set(items.map((item) => item.productId).filter((value): value is string => !!value))];
          if (productIds.length) {
            const owned = await tx.product.count({ where: { id: { in: productIds }, businessId: context.businessId } });
            if (owned !== productIds.length) throw ApiError.validation({ items: ["Item not found"] });
          }
        }

        await tx.invoice.update({
          where: { id },
          data: {
            ...header,
            ...(clientId !== undefined ? { clientId } : {}),
            ...(header.issueDate ? { issueDate: fromIsoDate(header.issueDate) } : {}),
            ...(header.dueDate ? { dueDate: fromIsoDate(header.dueDate) } : {}),
          },
        });

        if (items) {
          await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
          if (items.length) {
            await tx.invoiceItem.createMany({ data: items.map((item, position) => ({ ...documentItemRow(item, position), invoiceId: id })) });
          }
        }
        await recalculate(tx, id);
      });
    } catch (error) {
      // A line id that already belongs to another invoice.
      if (isPrismaError(error, "P2002")) throw ApiError.validation({ items: ["Line ids must be unique"] });
      throw error;
    }

    return this.get(context, id);
  },

  async remove(context: BusinessContext, id: string): Promise<void> {
    const invoice = await loadDetail(context, id);
    assertCan(invoice, "delete");
    await db.invoice.delete({ where: { id } });
  },

  /**
   * "Mark as sent": validates, freezes issuer and client, and publishes the link. `channel`
   * records how it left the building, so the history reads as one line per action (design b3).
   */
  async send(context: BusinessContext, id: string, channel: SendChannel = { channel: "manual" }): Promise<InvoiceDto> {
    await db.$transaction((tx) => this.sendInTx(tx, context, id, channel));
    return this.get(context, id);
  },

  /**
   * The send transition, for callers that already hold a transaction (converting an estimate
   * sends inside its own, so a refused send converts nothing). Locks the Business row before the
   * invoice — the same order number reservation uses — then applies the plan's send gate.
   */
  async sendInTx(tx: Tx, context: BusinessContext, id: string, channel: SendChannel = { channel: "manual" }) {
    await billingRepository.lockBusiness(tx, context.businessId);
    if (!(await invoiceRepository.lock(tx, context.businessId, id))) throw ApiError.notFound("Invoice");
    const invoice = await loadDetail(context, id, tx);
    assertCan(invoice, "send");

    const problems = findIssueProblems({
      clientId: invoice.clientId,
      issueDate: toIsoDate(invoice.issueDate),
      endDate: toIsoDate(invoice.dueDate),
      items: invoice.items.map(toItemDto),
    });
    if (problems.length) throw ApiError.validation(problemsToFieldErrors(problems), "Fix these before sending");

    const { branded } = await billingService.assertSendAllowed(tx, context, invoice, { countsTowardLimit: true });

    const business = await tx.business.findUniqueOrThrow({ where: { id: context.businessId } });
    const client = await tx.client.findUniqueOrThrow({ where: { id: invoice.clientId! } });
    await tx.invoice.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        publicToken: generatePublicToken(),
        issuerSnapshot: issuerSnapshot(business, branded) as unknown as Prisma.InputJsonValue,
        billToSnapshot: billToSnapshot(client) as unknown as Prisma.InputJsonValue,
        amountDue: invoice.total,
      },
    });
    await invoiceRepository.addEvent(tx, id, "SENT", { ...channel });
  },

  async duplicate(context: BusinessContext, id: string): Promise<InvoiceDto> {
    const source = await loadDetail(context, id);
    const clientId = source.client && !source.client.deletedAt ? source.client.id : null;
    const draft = await this.create(context, { clientId });
    await this.update(context, draft.id, {
      currency: source.currency,
      notes: source.notes ?? "",
      terms: source.terms ?? "",
      template: source.template,
      color: source.color,
      items: source.items.map((item) => ({ ...toItemDto(item), id: randomUUID() })),
    });
    await db.$transaction((tx) =>
      invoiceRepository.addEvent(tx, draft.id, "DUPLICATED", { fromInvoiceId: source.id, fromNumber: source.number }),
    );
    return this.get(context, draft.id);
  },

  async cancel(context: BusinessContext, id: string): Promise<InvoiceDto> {
    await db.$transaction(async (tx) => {
      if (!(await invoiceRepository.lock(tx, context.businessId, id))) throw ApiError.notFound("Invoice");
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });
      assertCan(invoice, "cancel");
      // The public link dies with the invoice, so nobody pays a cancelled document.
      await tx.invoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), publicToken: null } });
      await invoiceRepository.addEvent(tx, id, "CANCELLED");
    });
    return this.get(context, id);
  },

  async revokeLink(context: BusinessContext, id: string): Promise<InvoiceDto> {
    await db.$transaction(async (tx) => {
      if (!(await invoiceRepository.lock(tx, context.businessId, id))) throw ApiError.notFound("Invoice");
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });
      if (!invoice.publicToken) throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, STATUS_MESSAGES.revokeLink);
      await tx.invoice.update({ where: { id }, data: { publicToken: null } });
      await invoiceRepository.addEvent(tx, id, "LINK_REVOKED");
    });
    return this.get(context, id);
  },

  /** A fresh link after a revoke. The old token stays dead. */
  async createLink(context: BusinessContext, id: string): Promise<InvoiceDto> {
    await db.$transaction(async (tx) => {
      if (!(await invoiceRepository.lock(tx, context.businessId, id))) throw ApiError.notFound("Invoice");
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });
      if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
        throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, "Only sent invoices can be shared.");
      }
      if (!invoice.publicToken) {
        await tx.invoice.update({ where: { id }, data: { publicToken: generatePublicToken() } });
      }
    });
    return this.get(context, id);
  },

  /** The official PDF, rendered on the server from persisted data (spec §31). */
  async pdf(context: BusinessContext, id: string): Promise<{ pdf: Buffer; number: string }> {
    const detail = await loadDetail(context, id);
    const dto = await toDto(context, detail);
    if (dto.issues.length) {
      throw ApiError.validation(problemsToFieldErrors(dto.issues), "Fix these before downloading the PDF");
    }
    const view = invoiceViewFrom(dto, await documentParties(detail));
    return { pdf: await renderDocumentPdf(view, dto.template), number: dto.number };
  },

  count(context: BusinessContext) {
    return invoiceRepository.count(context.businessId);
  },
};
