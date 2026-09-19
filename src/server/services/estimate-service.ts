import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { ApiList, ConvertEstimateResultDto, EstimateDto, EstimateListItemDto, EstimateSummaryDto } from "@/lib/api-types";
import { isCurrencyCode } from "@/lib/currencies";
import { addDays, daysBetween, fromIsoDate, todayIn, toIsoDate } from "@/lib/dates";
import { findIssueProblems, problemsToFieldErrors } from "@/lib/documents/issues";
import { addMoney, calculateTotals } from "@/lib/documents/math";
import { canPerformEstimate, type EstimateAction } from "@/lib/estimates/status";
import { formatDocumentNumber } from "@/lib/numbering";
import { toFieldErrors } from "@/lib/validation/errors";
import {
  convertEstimateSchema,
  createEstimateSchema,
  listEstimatesQuerySchema,
  updateEstimateSchema,
} from "@/lib/validation/estimate";
import { ApiError, ErrorCode } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { db } from "@/server/db";
import { documentItemRow } from "@/server/documents/lines";
import { generatePublicToken } from "@/server/documents/public-token";
import type { SendChannel } from "@/server/documents/send-channel";
import { documentParties, estimateViewFrom, renderDocumentPdf } from "@/server/documents/render";
import { billToSnapshot, issuerSnapshot } from "@/server/documents/snapshots";
import { toEstimateDto, toEstimateListItemDto } from "@/server/estimates/serializers";
import { toItemDto, toLineInput } from "@/server/invoices/serializers";
import { businessRepository } from "@/server/repositories/business-repository";
import { estimateRepository, type EstimateDetail } from "@/server/repositories/estimate-repository";
import { invoiceRepository, type Tx } from "@/server/repositories/invoice-repository";
import { isPrismaError } from "@/server/repositories/prisma-errors";
import { billingService } from "./billing-service";
import { invoiceService } from "./invoice-service";

export type ReplyBy = "client" | "you";

const MESSAGES: Record<EstimateAction, string> = {
  edit: "Only drafts can be edited. Duplicate this estimate to change it.",
  delete: "Only drafts can be deleted.",
  send: "This estimate was already sent.",
  email: "This estimate can no longer be emailed — it expired or was already converted.",
  accept: "This estimate can't be accepted anymore.",
  decline: "This estimate can't be declined anymore.",
  reopen: "Only a declined estimate that is still valid can be reopened.",
  convert: "Only accepted estimates can be converted to an invoice.",
  markViewed: "This estimate can't be marked as viewed.",
  revokeLink: "This estimate has no public link.",
  createLink: "Only sent estimates can be shared.",
};

async function today(businessId: string) {
  const business = await businessRepository.findById(businessId);
  return { business, today: todayIn(business.timezone) };
}

function assertCan(
  estimate: { status: EstimateDetail["status"]; expiryDate: Date; convertedInvoiceId: string | null },
  action: EstimateAction,
  day: string,
) {
  const input = { status: estimate.status, expiryDate: toIsoDate(estimate.expiryDate), convertedInvoiceId: estimate.convertedInvoiceId };
  if (!canPerformEstimate(input, action, day)) {
    const expired = input.expiryDate < day && (action === "accept" || action === "decline" || action === "reopen");
    throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, expired ? "This estimate has expired." : MESSAGES[action]);
  }
}

async function recalculate(tx: Tx, estimateId: string) {
  const items = await tx.estimateItem.findMany({ where: { estimateId } });
  await tx.estimate.update({
    where: { id: estimateId },
    data: calculateTotals(items.map((item) => toLineInput(toItemDto(item)))),
  });
}

async function loadDetail(context: BusinessContext, id: string, client: Tx | typeof db = db) {
  const estimate = await estimateRepository.findDetail(context.businessId, id, client);
  if (!estimate) throw ApiError.notFound("Estimate");
  return estimate;
}

async function findOwnedClient(businessId: string, clientId: string, client: Tx | typeof db = db) {
  const found = await client.client.findFirst({ where: { id: clientId, businessId, deletedAt: null } });
  if (!found) throw ApiError.validation({ clientId: ["Client not found"] });
  return found;
}

/** Runs a status change under a row lock, so concurrent replies can't both win. */
async function transition(
  context: BusinessContext,
  id: string,
  change: (tx: Tx, estimate: NonNullable<Awaited<ReturnType<Tx["estimate"]["findUnique"]>>>, day: string) => Promise<void>,
) {
  const { today: day } = await today(context.businessId);
  await db.$transaction(async (tx) => {
    if (!(await estimateRepository.lock(tx, context.businessId, id))) throw ApiError.notFound("Estimate");
    const estimate = await tx.estimate.findUniqueOrThrow({ where: { id } });
    await change(tx, estimate, day);
  });
}

export const estimateService = {
  async list(context: BusinessContext, query: unknown): Promise<ApiList<EstimateListItemDto>> {
    const parsed = listEstimatesQuerySchema.safeParse(query);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { today: day } = await today(context.businessId);
    const { items, total } = await estimateRepository.list(context.businessId, parsed.data, fromIsoDate(day));
    return {
      data: items.map((estimate) => toEstimateListItemDto(estimate, day)),
      pagination: { page: parsed.data.page, limit: parsed.data.limit, total },
    };
  },

  async get(context: BusinessContext, id: string): Promise<EstimateDto> {
    const { today: day } = await today(context.businessId);
    return toEstimateDto(await loadDetail(context, id), day);
  },

  count(context: BusinessContext) {
    return estimateRepository.count(context.businessId);
  },

  /** Creates a numbered draft valid for the business's usual number of days. */
  async create(context: BusinessContext, input: unknown): Promise<EstimateDto> {
    const parsed = createEstimateSchema.safeParse(input ?? {});
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { business, today: day } = await today(context.businessId);

    const client = parsed.data.clientId ? await findOwnedClient(context.businessId, parsed.data.clientId) : null;
    const productIds = parsed.data.productIds ?? [];
    const products = productIds.length
      ? await db.product.findMany({ where: { id: { in: productIds }, businessId: context.businessId, deletedAt: null } })
      : [];
    if (products.length !== new Set(productIds).size) throw ApiError.validation({ productIds: ["Item not found"] });

    const id = await db.$transaction(async (tx) => {
      const { sequence, prefix, validity } = await estimateRepository.reserveNumber(tx, context.businessId);
      const estimate = await tx.estimate.create({
        data: {
          businessId: context.businessId,
          clientId: client?.id ?? null,
          sequence,
          number: formatDocumentNumber(prefix, sequence),
          issueDate: fromIsoDate(day),
          expiryDate: fromIsoDate(addDays(day, validity)),
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
        await tx.estimateItem.createMany({ data: rows.map((row) => ({ ...row, estimateId: estimate.id })) });
        await recalculate(tx, estimate.id);
      }
      await estimateRepository.addEvent(tx, estimate.id, "CREATED", { number: estimate.number });
      return estimate.id;
    });
    return this.get(context, id);
  },

  async update(context: BusinessContext, id: string, input: unknown): Promise<EstimateDto> {
    const parsed = updateEstimateSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { items, clientId, issueDate, expiryDate, ...header } = parsed.data;

    try {
      await transition(context, id, async (tx, estimate, day) => {
        assertCan(estimate, "edit", day);
        if (clientId) await findOwnedClient(context.businessId, clientId, tx);
        if (items) {
          const productIds = [...new Set(items.map((item) => item.productId).filter((value): value is string => !!value))];
          if (productIds.length) {
            const owned = await tx.product.count({ where: { id: { in: productIds }, businessId: context.businessId } });
            if (owned !== productIds.length) throw ApiError.validation({ items: ["Item not found"] });
          }
        }
        await tx.estimate.update({
          where: { id },
          data: {
            ...header,
            ...(clientId !== undefined ? { clientId } : {}),
            ...(issueDate ? { issueDate: fromIsoDate(issueDate) } : {}),
            ...(expiryDate ? { expiryDate: fromIsoDate(expiryDate) } : {}),
          },
        });
        if (items) {
          await tx.estimateItem.deleteMany({ where: { estimateId: id } });
          if (items.length) {
            await tx.estimateItem.createMany({
              data: items.map((item, position) => ({ ...documentItemRow(item, position), estimateId: id })),
            });
          }
        }
        await recalculate(tx, id);
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) throw ApiError.validation({ items: ["Line ids must be unique"] });
      throw error;
    }
    return this.get(context, id);
  },

  async remove(context: BusinessContext, id: string): Promise<void> {
    await transition(context, id, async (tx, estimate, day) => {
      assertCan(estimate, "delete", day);
      await tx.estimate.delete({ where: { id } });
    });
  },

  async send(context: BusinessContext, id: string, channel: SendChannel = { channel: "manual" }): Promise<EstimateDto> {
    await transition(context, id, async (tx, estimate, day) => {
      assertCan(estimate, "send", day);
      const detail = await loadDetail(context, id, tx);
      const problems = findIssueProblems(
        {
          clientId: detail.clientId,
          issueDate: toIsoDate(detail.issueDate),
          endDate: toIsoDate(detail.expiryDate),
          items: detail.items.map(toItemDto),
        },
        { endPath: "expiryDate", endLabel: "Expiry date" },
      );
      if (problems.length) throw ApiError.validation(problemsToFieldErrors(problems), "Fix these before sending");
      if (toIsoDate(detail.expiryDate) < day) {
        throw ApiError.validation({ expiryDate: ["The expiry date has already passed"] }, "Fix these before sending");
      }

      // Estimates never count toward the monthly limit, but Pro options still need Pro.
      const { branded } = await billingService.assertSendAllowed(tx, context, detail, { countsTowardLimit: false });

      const business = await tx.business.findUniqueOrThrow({ where: { id: context.businessId } });
      const client = await tx.client.findUniqueOrThrow({ where: { id: detail.clientId! } });
      await tx.estimate.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          publicToken: generatePublicToken("est"),
          issuerSnapshot: issuerSnapshot(business, branded) as unknown as Prisma.InputJsonValue,
          billToSnapshot: billToSnapshot(client) as unknown as Prisma.InputJsonValue,
        },
      });
      await estimateRepository.addEvent(tx, id, "SENT", { ...channel });
    });
    return this.get(context, id);
  },

  /**
   * Records the client's answer, from the public page (`client`) or entered by the business (`you`).
   * Repeating the same answer is a no-op; the opposite answer afterwards is refused.
   */
  async reply(context: BusinessContext, id: string, answer: "accept" | "decline", by: ReplyBy): Promise<EstimateDto> {
    await transition(context, id, async (tx, estimate, day) => {
      const already = answer === "accept" ? ["ACCEPTED", "CONVERTED"] : ["DECLINED"];
      if (already.includes(estimate.status)) return;
      assertCan(estimate, answer, day);
      const now = new Date();
      await tx.estimate.update({
        where: { id },
        data:
          answer === "accept"
            ? { status: "ACCEPTED", acceptedAt: now, declinedAt: null, respondedBy: by }
            : { status: "DECLINED", declinedAt: now, respondedBy: by },
      });
      await estimateRepository.addEvent(tx, id, answer === "accept" ? "ACCEPTED" : "DECLINED", { by });
    });
    return this.get(context, id);
  },

  async reopen(context: BusinessContext, id: string): Promise<EstimateDto> {
    await transition(context, id, async (tx, estimate, day) => {
      assertCan(estimate, "reopen", day);
      await tx.estimate.update({
        where: { id },
        data: { status: estimate.viewedAt ? "VIEWED" : "SENT", declinedAt: null, respondedBy: null },
      });
      await estimateRepository.addEvent(tx, id, "REOPENED");
    });
    return this.get(context, id);
  },

  async duplicate(context: BusinessContext, id: string): Promise<EstimateDto> {
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
      estimateRepository.addEvent(tx, draft.id, "DUPLICATED", { fromEstimateId: source.id, fromNumber: source.number }),
    );
    return this.get(context, draft.id);
  },

  async revokeLink(context: BusinessContext, id: string): Promise<EstimateDto> {
    await transition(context, id, async (tx, estimate) => {
      if (!estimate.publicToken) throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, MESSAGES.revokeLink);
      await tx.estimate.update({ where: { id }, data: { publicToken: null } });
      await estimateRepository.addEvent(tx, id, "LINK_REVOKED");
    });
    return this.get(context, id);
  },

  async createLink(context: BusinessContext, id: string): Promise<EstimateDto> {
    await transition(context, id, async (tx, estimate, day) => {
      assertCan(estimate, "createLink", day);
      if (!estimate.publicToken) {
        await tx.estimate.update({ where: { id }, data: { publicToken: generatePublicToken("est") } });
      }
    });
    return this.get(context, id);
  },

  async pdf(context: BusinessContext, id: string): Promise<{ pdf: Buffer; number: string }> {
    const detail = await loadDetail(context, id);
    const dto = await this.get(context, id);
    if (dto.issues.length) {
      throw ApiError.validation(problemsToFieldErrors(dto.issues), "Fix these before downloading the PDF");
    }
    const view = estimateViewFrom(dto, await documentParties(detail));
    return { pdf: await renderDocumentPdf(view, dto.template), number: dto.number };
  },

  /**
   * Creates a draft invoice from an accepted estimate: same client, lines, prices, notes and look.
   * The estimate itself is only marked Converted. The invoice number is assigned now.
   */
  async convert(context: BusinessContext, id: string, input: unknown): Promise<ConvertEstimateResultDto> {
    const parsed = convertEstimateSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { issueDate, dueDate, send } = parsed.data;

    if (send) {
      // Check up front, so a conversion never leaves an invoice behind that can't be sent.
      const current = await loadDetail(context, id);
      const problems = findIssueProblems({
        clientId: current.client && !current.client.deletedAt ? current.clientId : null,
        issueDate,
        endDate: dueDate,
        items: current.items.map(toItemDto),
      });
      if (problems.length) throw ApiError.validation(problemsToFieldErrors(problems), "The invoice couldn't be sent");
    }

    let invoiceId = "";
    await transition(context, id, async (tx, estimate, day) => {
      assertCan(estimate, "convert", day);
      const items = await tx.estimateItem.findMany({ where: { estimateId: id }, orderBy: { position: "asc" } });
      const { sequence, prefix } = await invoiceRepository.reserveNumber(tx, context.businessId);
      const rows = items.map((item, position) => documentItemRow({ ...toItemDto(item), id: randomUUID() }, position));
      const totals = calculateTotals(items.map((item) => toLineInput(toItemDto(item))));
      const invoice = await tx.invoice.create({
        data: {
          businessId: context.businessId,
          clientId: estimate.clientId,
          sequence,
          number: formatDocumentNumber(prefix, sequence),
          issueDate: fromIsoDate(issueDate),
          dueDate: fromIsoDate(dueDate),
          currency: estimate.currency,
          notes: estimate.notes,
          terms: estimate.terms,
          template: estimate.template,
          color: estimate.color,
          ...totals,
          amountDue: totals.total,
          items: { createMany: { data: rows } },
        },
      });
      invoiceId = invoice.id;
      await invoiceRepository.addEvent(tx, invoice.id, "CREATED", {
        number: invoice.number,
        fromEstimateId: id,
        fromNumber: estimate.number,
      });
      await tx.estimate.update({
        where: { id },
        data: { status: "CONVERTED", convertedAt: new Date(), convertedInvoiceId: invoice.id },
      });
      await estimateRepository.addEvent(tx, id, "CONVERTED", { invoiceId: invoice.id, invoiceNumber: invoice.number });
      // Sent in the same transaction: if the plan refuses the send, nothing is converted.
      if (send) await invoiceService.sendInTx(tx, context, invoice.id);
    });

    return { invoice: await invoiceService.get(context, invoiceId), estimate: await this.get(context, id) };
  },

  /** Numbers for the estimates overview (design c1), one currency at a time. */
  async summary(context: BusinessContext, requestedCurrency?: string | null): Promise<EstimateSummaryDto> {
    const { business, today: day } = await today(context.businessId);
    const currency =
      requestedCurrency && isCurrencyCode(requestedCurrency.toUpperCase())
        ? requestedCurrency.toUpperCase()
        : business.defaultCurrency;
    const [year, month] = day.split("-").map(Number);
    const quarterStart = new Date(Date.UTC(year, Math.floor((month - 1) / 3) * 3, 1));
    const ninetyDaysAgo = fromIsoDate(addDays(day, -90));

    const [estimates, currencies] = await Promise.all([
      db.estimate.findMany({
        where: {
          businessId: context.businessId,
          currency,
          status: { not: "DRAFT" },
          OR: [
            { status: { in: ["SENT", "VIEWED", "ACCEPTED"] } },
            { status: "CONVERTED", convertedInvoiceId: null },
            { sentAt: { gte: quarterStart < ninetyDaysAgo ? quarterStart : ninetyDaysAgo } },
          ],
        },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          expiryDate: true,
          sentAt: true,
          viewedAt: true,
          acceptedAt: true,
          declinedAt: true,
          convertedInvoiceId: true,
          client: { select: { name: true } },
        },
      }),
      db.estimate.findMany({
        where: { businessId: context.businessId, status: { not: "DRAFT" } },
        distinct: ["currency"],
        select: { currency: true },
      }),
    ]);

    const sum = (rows: { total: { toFixed(digits: number): string } }[]) => addMoney(...rows.map((row) => row.total.toFixed(2)));

    const awaiting = estimates.filter(
      (estimate) => (estimate.status === "SENT" || estimate.status === "VIEWED") && toIsoDate(estimate.expiryDate) >= day,
    );
    const readyToConvert = estimates
      .filter((estimate) => estimate.status === "ACCEPTED" || (estimate.status === "CONVERTED" && !estimate.convertedInvoiceId))
      .sort((a, b) => (a.acceptedAt?.getTime() ?? 0) - (b.acceptedAt?.getTime() ?? 0));

    const sentThisQuarter = estimates.filter((estimate) => estimate.sentAt && estimate.sentAt >= quarterStart);
    const decided = sentThisQuarter.filter(
      (estimate) =>
        estimate.status === "ACCEPTED" ||
        estimate.status === "CONVERTED" ||
        estimate.status === "DECLINED" ||
        toIsoDate(estimate.expiryDate) < day,
    );
    const won = decided.filter((estimate) => estimate.status === "ACCEPTED" || estimate.status === "CONVERTED");

    const replyDays = estimates
      .map((estimate) => {
        const repliedAt = estimate.acceptedAt ?? estimate.declinedAt;
        const from = estimate.viewedAt ?? estimate.sentAt;
        if (!repliedAt || !from || repliedAt < ninetyDaysAgo) return null;
        return Math.max(0, daysBetween(toIsoDate(from), toIsoDate(repliedAt)));
      })
      .filter((value): value is number => value !== null);

    const oldest = readyToConvert[0];
    return {
      currency,
      otherCurrencies: currencies.map((row) => row.currency).filter((code) => code !== currency).sort(),
      awaitingReply: { amount: sum(awaiting), count: awaiting.length },
      acceptedNotInvoiced: { amount: sum(readyToConvert), count: readyToConvert.length },
      wonThisQuarter: {
        percent: decided.length ? Math.round((won.length / decided.length) * 100) : null,
        accepted: won.length,
        decided: decided.length,
      },
      averageReplyDays: replyDays.length ? Math.round(replyDays.reduce((a, b) => a + b, 0) / replyDays.length) : null,
      readyToConvert: oldest
        ? {
            id: oldest.id,
            number: oldest.number,
            clientName: oldest.client?.name ?? null,
            acceptedAt: (oldest.acceptedAt ?? new Date()).toISOString(),
          }
        : null,
    };
  },
};
