import type { Prisma } from "@/generated/prisma/client";
import { calculateLine } from "@/lib/documents/math";
import type { DocumentItemInput } from "@/lib/validation/document";

/** Columns shared by InvoiceItem and EstimateItem, minus the parent id. */
export type DocumentItemRow = Omit<Prisma.InvoiceItemCreateManyInput, "invoiceId">;

/** One stored line, with its amounts computed on the server and inconsistent inputs cleaned up. */
export function documentItemRow(item: DocumentItemInput, position: number): DocumentItemRow {
  const amounts = calculateLine({
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountType: item.discountType,
    discountValue: item.discountValue,
    taxRate: item.taxRate,
    taxExempt: item.taxExempt,
  });
  return {
    id: item.id,
    productId: item.productId ?? null,
    position,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountType: item.discountValue ? item.discountType : null,
    discountValue: item.discountType ? item.discountValue : null,
    taxRate: item.taxExempt ? "0" : item.taxRate,
    taxExempt: item.taxExempt,
    taxExemptReason: item.taxExempt ? (item.taxExemptReason ?? null) : null,
    ...amounts,
  };
}
