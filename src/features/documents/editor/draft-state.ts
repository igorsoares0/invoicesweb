import type { DocumentTemplate } from "@/lib/api-types";
import { isValidIsoDate } from "@/lib/dates";
import type { LineInput } from "@/lib/documents/math";
import { parseMoneyInput } from "@/lib/documents/line-text";
import type { FieldErrors } from "@/lib/validation/errors";
import type { EditableDocument } from "./kinds";

/** A line as the user is typing it: numeric fields stay raw strings until they're valid. */
export interface DraftItem {
  id: string;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: string;
  taxRate: string;
  taxExempt: boolean;
  taxExemptReason: string;
}

export interface DraftState {
  clientId: string | null;
  issueDate: string;
  endDate: string;
  currency: string;
  notes: string;
  terms: string;
  template: DocumentTemplate;
  color: string;
  items: DraftItem[];
}

const trimZeros = (value: string) => value.replace(/\.00$/, "");

export function toDraft(invoice: EditableDocument): DraftState {
  return {
    clientId: invoice.client?.deleted ? null : (invoice.client?.id ?? null),
    issueDate: invoice.issueDate,
    endDate: invoice.endDate,
    currency: invoice.currency,
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    template: invoice.template,
    color: invoice.color,
    items: invoice.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? "",
      discountType: item.discountType,
      discountValue: item.discountValue ? trimZeros(item.discountValue) : "",
      taxRate: trimZeros(item.taxRate),
      taxExempt: item.taxExempt,
      taxExemptReason: item.taxExemptReason ?? "",
    })),
  };
}

export function newLineId(): string {
  return `line_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function blankItem(taxRate: string | null): DraftItem {
  return {
    id: newLineId(),
    productId: null,
    description: "",
    quantity: "1",
    unitPrice: "",
    discountType: null,
    discountValue: "",
    taxRate: taxRate ? trimZeros(taxRate) : "0",
    taxExempt: false,
    taxExemptReason: "",
  };
}

const QUANTITY = /^\d{1,9}(\.\d{1,3})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** Reads a typed line as math input, treating anything unparseable as absent. */
export function lineInput(item: DraftItem): LineInput {
  const discount = parseMoneyInput(item.discountValue);
  return {
    quantity: QUANTITY.test(item.quantity) ? item.quantity : "0",
    unitPrice: parseMoneyInput(item.unitPrice),
    discountType: discount ? item.discountType : null,
    discountValue: discount,
    taxRate: PERCENT.test(item.taxRate) ? item.taxRate : "0",
    taxExempt: item.taxExempt,
  };
}

/**
 * Turns the draft into the PATCH body. Typing mistakes (a price of "abc") become local field
 * errors and block autosave until fixed, so half-typed values never overwrite good ones.
 */
export function toPayload(
  draft: DraftState,
  endDateField: "dueDate" | "expiryDate" = "dueDate",
): { payload: Record<string, unknown>; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const fail = (path: string, message: string) => (errors[path] ??= []).push(message);

  if (!isValidIsoDate(draft.issueDate)) fail("issueDate", "Enter a valid date");
  if (!isValidIsoDate(draft.endDate)) fail(endDateField, "Enter a valid date");

  const items = draft.items.map((item) => {
    const path = `items.${item.id}`;
    if (!QUANTITY.test(item.quantity) || Number(item.quantity) <= 0) fail(`${path}.quantity`, "Enter a quantity above 0");
    const unitPrice = parseMoneyInput(item.unitPrice);
    if (item.unitPrice.trim() && unitPrice === null) fail(`${path}.unitPrice`, "Enter a price like 140 or 140.50");
    const discountValue = parseMoneyInput(item.discountValue);
    if (item.discountValue.trim() && discountValue === null) fail(`${path}.discountValue`, "Enter a number");
    if (item.discountType === "PERCENT" && discountValue && Number(discountValue) > 100) {
      fail(`${path}.discountValue`, "A discount can't exceed 100%");
    }
    if (!PERCENT.test(item.taxRate) || Number(item.taxRate) > 100) fail(`${path}.taxRate`, "Enter a rate between 0 and 100");
    return {
      id: item.id,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      discountType: discountValue ? item.discountType : null,
      discountValue: item.discountType ? discountValue : null,
      taxRate: item.taxExempt ? "0" : item.taxRate,
      taxExempt: item.taxExempt,
      taxExemptReason: item.taxExempt ? item.taxExemptReason : "",
    };
  });

  return {
    payload: {
      clientId: draft.clientId,
      issueDate: draft.issueDate,
      [endDateField]: draft.endDate,
      currency: draft.currency,
      notes: draft.notes,
      terms: draft.terms,
      template: draft.template,
      color: draft.color,
      items,
    },
    errors,
  };
}
