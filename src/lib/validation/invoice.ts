import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates";
import { currencyCode, listQuery, moneyAmount, optionalText, percentage } from "./common";

export const DOCUMENT_TEMPLATES = ["MODERN", "CLASSIC", "MINIMAL", "PROFESSIONAL", "BOLD"] as const;
export const PAYMENT_METHODS = ["BANK_TRANSFER", "CARD", "CASH", "PAYPAL", "OTHER"] as const;
export const ACCENT_COLORS = ["#1e40af", "#18181b", "#15803d", "#b45309", "#7c3aed"] as const;

export const isoDate = z.string().refine(isValidIsoDate, "Enter a valid date");

/** Up to 3 decimals so hours like 1.5 or 0.25 work. */
const quantity = z
  .union([z.string().trim(), z.number().transform(String)])
  .refine((value) => /^\d{1,9}(\.\d{1,3})?$/.test(value) && Number(value) > 0, "Enter a quantity above 0");

/** Client-generated ids keep lines stable across autosaves (React keys, error paths). */
const itemId = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "Invalid line id");

export const invoiceItemSchema = z
  .object({
    id: itemId,
    productId: z.string().max(40).nullable().optional(),
    description: z.string().trim().max(500, "Use at most 500 characters"),
    quantity,
    unitPrice: moneyAmount.nullable(),
    discountType: z.enum(["PERCENT", "FIXED"]).nullable(),
    discountValue: moneyAmount.nullable(),
    taxRate: percentage,
    taxExempt: z.boolean(),
    taxExemptReason: optionalText(300),
  })
  .superRefine((item, ctx) => {
    if (item.discountType === "PERCENT" && item.discountValue !== null && Number(item.discountValue) > 100) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "A discount can't exceed 100%" });
    }
  });

export const createInvoiceSchema = z.object({
  clientId: z.string().max(40).nullable().optional(),
  /** Start the draft with these catalog items as lines. */
  productIds: z.array(z.string().max(40)).max(50).optional(),
});

/** Draft autosave. Every field is optional; `items`, when present, replaces all lines. */
export const updateInvoiceSchema = z
  .object({
    clientId: z.string().max(40).nullable(),
    issueDate: isoDate,
    dueDate: isoDate,
    currency: currencyCode,
    notes: optionalText(2000),
    terms: optionalText(2000),
    template: z.enum(DOCUMENT_TEMPLATES),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color"),
    items: z.array(invoiceItemSchema).max(200, "Use at most 200 lines"),
  })
  .partial()
  .superRefine((invoice, ctx) => {
    const ids = new Set<string>();
    invoice.items?.forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: ["items", index, "id"], message: "Duplicate line id" });
      ids.add(item.id);
    });
  });

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

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];
