import { z } from "zod";
import { currencyCode, listQuery, moneyAmount, optionalText } from "./common";
import { checkUniqueLineIds, createDocumentSchema, documentDraftFields, isoDate } from "./document";

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CARD", "CASH", "PAYPAL", "OTHER"] as const;

export const createInvoiceSchema = createDocumentSchema;

/** Draft autosave. Every field is optional; `items`, when present, replaces all lines. */
export const updateInvoiceSchema = z
  .object({ ...documentDraftFields, dueDate: isoDate })
  .partial()
  .superRefine(checkUniqueLineIds);

export const recordPaymentSchema = z.object({
  amount: moneyAmount.refine((value) => Number(value) > 0, "Enter an amount above 0"),
  currency: currencyCode.optional(),
  paymentDate: isoDate,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(100),
  notes: optionalText(500),
});

export const markPaidSchema = z.object({
  paymentDate: isoDate.optional(),
  method: z.enum(PAYMENT_METHODS).default("BANK_TRANSFER"),
  reference: optionalText(100),
});

export const INVOICE_FILTERS = ["all", "draft", "sent", "overdue", "paid", "cancelled"] as const;
export const INVOICE_SORT_FIELDS = ["number", "dueDate", "issueDate", "total", "createdAt"] as const;

export const listInvoicesQuerySchema = listQuery(INVOICE_SORT_FIELDS, { sort: "number", order: "desc" }).extend({
  status: z.enum(INVOICE_FILTERS).default("all"),
  clientId: z.string().max(40).optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];
