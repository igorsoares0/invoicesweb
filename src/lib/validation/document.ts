import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates";
import { MAX_EMAIL_MESSAGE, MAX_EMAIL_RECIPIENTS, MAX_EMAIL_SUBJECT } from "@/lib/documents/email-text";
import { currencyCode, email, moneyAmount, optionalText, percentage } from "./common";

/** Shared by invoices and estimates: lines, templates and the draft fields both documents have. */

export const DOCUMENT_TEMPLATES = ["MODERN", "CLASSIC", "MINIMAL", "PROFESSIONAL", "BOLD"] as const;
export const ACCENT_COLORS = ["#1e40af", "#18181b", "#15803d", "#b45309", "#7c3aed"] as const;

export const isoDate = z.string().refine(isValidIsoDate, "Enter a valid date");

/** Up to 3 decimals so hours like 1.5 or 0.25 work. */
const quantity = z
  .union([z.string().trim(), z.number().transform(String)])
  .refine((value) => /^\d{1,9}(\.\d{1,3})?$/.test(value) && Number(value) > 0, "Enter a quantity above 0");

/** Client-generated ids keep lines stable across autosaves (React keys, error paths). */
const itemId = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "Invalid line id");

export const documentItemSchema = z
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

export const createDocumentSchema = z.object({
  clientId: z.string().max(40).nullable().optional(),
  /** Start the draft with these catalog items as lines. */
  productIds: z.array(z.string().max(40)).max(50).optional(),
});

/** Draft fields common to both documents; each adds its own end date (dueDate / expiryDate). */
export const documentDraftFields = {
  clientId: z.string().max(40).nullable(),
  issueDate: isoDate,
  currency: currencyCode,
  notes: optionalText(2000),
  terms: optionalText(2000),
  template: z.enum(DOCUMENT_TEMPLATES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color"),
  items: z.array(documentItemSchema).max(200, "Use at most 200 lines"),
};

export function checkUniqueLineIds(document: { items?: { id: string }[] }, ctx: z.RefinementCtx) {
  const ids = new Set<string>();
  document.items?.forEach((item, index) => {
    if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: ["items", index, "id"], message: "Duplicate line id" });
    ids.add(item.id);
  });
}

export type DocumentItemInput = z.infer<typeof documentItemSchema>;

/**
 * Sending a document by email. `subject` and `message` are optional so every caller — the
 * dialog, an API client, a future reminder — gets the same default text from one place.
 */
export const sendDocumentEmailSchema = z.object({
  to: z
    .array(email)
    .min(1, "Add at least one recipient")
    .max(MAX_EMAIL_RECIPIENTS, `Use at most ${MAX_EMAIL_RECIPIENTS} recipients`)
    // Two chips for the same address would email the client twice.
    .refine((values) => new Set(values).size === values.length, "That address is already on the list"),
  subject: z.string().trim().min(1, "Write a subject").max(MAX_EMAIL_SUBJECT, `Use at most ${MAX_EMAIL_SUBJECT} characters`).optional(),
  message: z
    .string()
    .trim()
    .min(1, "Write a message")
    .max(MAX_EMAIL_MESSAGE, `Use at most ${MAX_EMAIL_MESSAGE} characters`)
    .optional(),
  attachPdf: z.boolean().default(true),
  /** Blind-copy the account address, so the sender keeps a record. */
  sendCopy: z.boolean().default(true),
});

export type SendDocumentEmailInput = z.infer<typeof sendDocumentEmailSchema>;
