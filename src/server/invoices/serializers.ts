import type { Invoice, InvoiceItem } from "@/generated/prisma/client";
import type { InvoiceDto, InvoiceItemDto, InvoiceListItemDto } from "@/lib/api-types";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { findIssueProblems } from "@/lib/invoices/issues";
import type { LineInput } from "@/lib/invoices/math";
import { displayStatus } from "@/lib/invoices/status";
import type { InvoiceDetail } from "@/server/repositories/invoice-repository";

const money = (value: { toFixed(digits: number): string }) => value.toFixed(2);

export function toItemDto(item: InvoiceItem): InvoiceItemDto {
  return {
    id: item.id,
    productId: item.productId,
    position: item.position,
    description: item.description,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice ? money(item.unitPrice) : null,
    discountType: item.discountType,
    discountValue: item.discountValue ? money(item.discountValue) : null,
    taxRate: money(item.taxRate),
    taxExempt: item.taxExempt,
    taxExemptReason: item.taxExemptReason,
    subtotal: money(item.subtotal),
    discount: money(item.discount),
    tax: money(item.tax),
    total: money(item.total),
  };
}

export function toLineInput(item: Pick<InvoiceItemDto, keyof LineInput>): LineInput {
  return {
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountType: item.discountType,
    discountValue: item.discountValue,
    taxRate: item.taxRate,
    taxExempt: item.taxExempt,
  };
}

function baseFields(invoice: Invoice, today: IsoDate) {
  const dueDate = toIsoDate(invoice.dueDate);
  const amountDue = money(invoice.amountDue);
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    displayStatus: displayStatus({ status: invoice.status, dueDate, amountDue }, today),
    issueDate: toIsoDate(invoice.issueDate),
    dueDate,
    currency: invoice.currency,
    total: money(invoice.total),
    amountDue,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export function toInvoiceListItemDto(
  invoice: Invoice & { client: { id: string; name: string } | null; items: { description: string }[] },
  today: IsoDate,
): InvoiceListItemDto {
  return {
    ...baseFields(invoice, today),
    client: invoice.client,
    summary: invoice.items[0]?.description || null,
  };
}

export function toInvoiceDto(invoice: InvoiceDetail, today: IsoDate): InvoiceDto {
  const items = invoice.items.map(toItemDto);
  const base = baseFields(invoice, today);
  return {
    ...base,
    sequence: invoice.sequence,
    client: invoice.client
      ? {
          id: invoice.client.id,
          name: invoice.client.name,
          email: invoice.client.email,
          deleted: invoice.client.deletedAt !== null,
        }
      : null,
    subtotal: money(invoice.subtotal),
    discount: money(invoice.discount),
    tax: money(invoice.tax),
    amountPaid: money(invoice.amountPaid),
    notes: invoice.notes,
    terms: invoice.terms,
    template: invoice.template,
    color: invoice.color,
    publicToken: invoice.publicToken,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    viewedAt: invoice.viewedAt?.toISOString() ?? null,
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    items,
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: money(payment.amount),
      currency: payment.currency,
      paymentDate: toIsoDate(payment.paymentDate),
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
    })),
    events: invoice.events.map((event) => ({
      id: event.id,
      type: event.type,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    issues:
      invoice.status === "DRAFT"
        ? findIssueProblems({ clientId: invoice.clientId, issueDate: base.issueDate, dueDate: base.dueDate, items })
        : [],
    updatedAt: invoice.updatedAt.toISOString(),
  };
}
