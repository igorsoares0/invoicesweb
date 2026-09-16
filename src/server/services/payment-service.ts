import "server-only";
import type { InvoiceDto } from "@/lib/api-types";
import { fromIsoDate, todayIn } from "@/lib/dates";
import { addMoney, compareMoney, subtractMoney } from "@/lib/documents/math";
import { statusAfterPayment } from "@/lib/invoices/status";
import { formatMoney } from "@/lib/money";
import { toFieldErrors } from "@/lib/validation/errors";
import { markPaidSchema, recordPaymentSchema, type RecordPaymentInput } from "@/lib/validation/invoice";
import { ApiError } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { db } from "@/server/db";
import { businessRepository } from "@/server/repositories/business-repository";
import { invoiceRepository, type Tx } from "@/server/repositories/invoice-repository";
import { assertCan, invoiceService } from "./invoice-service";

/** Re-derives amountPaid, amountDue and the payment-driven status from the payments on file. */
async function settle(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  const amountPaid = addMoney(...invoice.payments.map((payment) => payment.amount.toFixed(2)));
  const total = invoice.total.toFixed(2);
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid,
      amountDue: subtractMoney(total, amountPaid),
      status: statusAfterPayment(total, amountPaid, invoice.viewedAt !== null),
    },
  });
}

async function record(context: BusinessContext, invoiceId: string, input: RecordPaymentInput, idempotencyKey: string | null) {
  await db.$transaction(async (tx) => {
    if (!(await invoiceRepository.lock(tx, context.businessId, invoiceId))) throw ApiError.notFound("Invoice");

    if (idempotencyKey) {
      const existing = await tx.payment.findUnique({ where: { invoiceId_idempotencyKey: { invoiceId, idempotencyKey } } });
      if (existing) return;
    }

    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    assertCan(invoice, "recordPayment");
    if (input.currency && input.currency !== invoice.currency) {
      throw ApiError.validation({ currency: [`This invoice is in ${invoice.currency}`] });
    }
    const due = invoice.amountDue.toFixed(2);
    if (compareMoney(input.amount, due) > 0) {
      throw ApiError.validation({ amount: [`Can't exceed the open balance of ${formatMoney(due, invoice.currency)}`] });
    }

    await tx.payment.create({
      data: {
        invoiceId,
        amount: input.amount,
        currency: invoice.currency,
        paymentDate: fromIsoDate(input.paymentDate),
        method: input.method,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        idempotencyKey,
      },
    });
    await settle(tx, invoiceId);
    await invoiceRepository.addEvent(tx, invoiceId, "PAYMENT_ADDED", { amount: input.amount, method: input.method });
  });
}

export const paymentService = {
  async record(context: BusinessContext, invoiceId: string, input: unknown, idempotencyKey: string | null): Promise<InvoiceDto> {
    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    if (idempotencyKey !== null && !/^[\w-]{8,100}$/.test(idempotencyKey)) {
      throw ApiError.validation({ _form: ["Idempotency-Key must be 8–100 letters, digits, _ or -"] });
    }
    await record(context, invoiceId, parsed.data, idempotencyKey);
    return invoiceService.get(context, invoiceId);
  },

  /** Records a payment for whatever is still open. */
  async markPaid(context: BusinessContext, invoiceId: string, input: unknown): Promise<InvoiceDto> {
    const parsed = markPaidSchema.safeParse(input ?? {});
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const invoice = await invoiceService.get(context, invoiceId);
    assertCan(invoice, "recordPayment");
    const business = await businessRepository.findById(context.businessId);
    await record(
      context,
      invoiceId,
      {
        amount: invoice.amountDue,
        paymentDate: parsed.data.paymentDate ?? todayIn(business.timezone),
        method: parsed.data.method,
        reference: parsed.data.reference,
      },
      null,
    );
    return invoiceService.get(context, invoiceId);
  },

  async remove(context: BusinessContext, invoiceId: string, paymentId: string): Promise<InvoiceDto> {
    await db.$transaction(async (tx) => {
      if (!(await invoiceRepository.lock(tx, context.businessId, invoiceId))) throw ApiError.notFound("Invoice");
      const payment = await tx.payment.findFirst({ where: { id: paymentId, invoiceId } });
      if (!payment) throw ApiError.notFound("Payment");
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      assertCan(invoice, "removePayment");
      await tx.payment.delete({ where: { id: paymentId } });
      await settle(tx, invoiceId);
      await invoiceRepository.addEvent(tx, invoiceId, "PAYMENT_REMOVED", { amount: payment.amount.toFixed(2) });
    });
    return invoiceService.get(context, invoiceId);
  },
};
