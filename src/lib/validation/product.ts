import { z } from "zod";
import type { FieldErrors } from "./errors";
import {
  listQuery,
  moneyAmount,
  optionalCurrencyCode,
  optionalText,
  percentage,
  requiredText,
} from "./common";

const productFields = {
  name: requiredText(200, "Item name"),
  description: optionalText(1000),
  unit: optionalText(30),
  unitPrice: moneyAmount,
  currency: optionalCurrencyCode,
  taxRate: percentage,
  taxExempt: z.boolean(),
  taxExemptReason: optionalText(300),
};

/**
 * VAT exemption must print a reason on the PDF, and an exempt line can't also carry a rate.
 * Shared by the create schema and by the service, which applies it to the merged state on update.
 */
export function checkTaxExemption(product: {
  taxExempt: boolean;
  taxRate: string;
  taxExemptReason?: string | null;
}): FieldErrors | null {
  if (!product.taxExempt) return null;
  const errors: FieldErrors = {};
  if (!product.taxExemptReason) {
    errors.taxExemptReason = ["An exemption reason is required — it prints on the PDF"];
  }
  if (Number(product.taxRate) !== 0) {
    errors.taxRate = ["Exempt items can't carry VAT"];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export const createProductSchema = z
  .object({
    ...productFields,
    taxRate: productFields.taxRate.default("0.00"),
    taxExempt: productFields.taxExempt.default(false),
  })
  .superRefine((product, ctx) => {
    const errors = checkTaxExemption(product);
    for (const [path, messages] of Object.entries(errors ?? {})) {
      for (const message of messages) ctx.addIssue({ code: "custom", path: [path], message });
    }
  });

export const updateProductSchema = z.object(productFields).partial();

export const PRODUCT_SORT_FIELDS = ["name", "createdAt", "unitPrice"] as const;
export const listProductsQuerySchema = listQuery(PRODUCT_SORT_FIELDS, { sort: "name", order: "asc" });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
