import "server-only";
import type { ApiList, ProductDto } from "@/lib/api-types";
import { toFieldErrors } from "@/lib/validation/errors";
import {
  checkTaxExemption,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "@/lib/validation/product";
import { ApiError } from "@/server/api/errors";
import type { BusinessContext } from "@/server/auth/types";
import { productRepository } from "@/server/repositories/product-repository";
import { toProductDto } from "@/server/repositories/serializers";

export const productService = {
  async list(context: BusinessContext, query: unknown): Promise<ApiList<ProductDto>> {
    const parsed = listProductsQuerySchema.safeParse(query);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { items, total } = await productRepository.list(context.businessId, parsed.data);
    return {
      data: items.map(toProductDto),
      pagination: { page: parsed.data.page, limit: parsed.data.limit, total },
    };
  },

  async get(context: BusinessContext, id: string): Promise<ProductDto> {
    const product = await productRepository.findById(context.businessId, id);
    if (!product) throw ApiError.notFound("Product");
    return toProductDto(product);
  },

  async create(context: BusinessContext, input: unknown): Promise<ProductDto> {
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const data = { ...parsed.data, taxExemptReason: parsed.data.taxExempt ? parsed.data.taxExemptReason : null };
    return toProductDto(await productRepository.create(context.businessId, data));
  },

  async update(context: BusinessContext, id: string, input: unknown): Promise<ProductDto> {
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));

    const current = await productRepository.findById(context.businessId, id);
    if (!current) throw ApiError.notFound("Product");

    // The exemption rule spans several fields, so check it against the state after the patch.
    const merged = {
      taxExempt: parsed.data.taxExempt ?? current.taxExempt,
      taxRate: parsed.data.taxRate ?? current.taxRate.toFixed(2),
      taxExemptReason:
        parsed.data.taxExemptReason !== undefined ? parsed.data.taxExemptReason : current.taxExemptReason,
    };
    const exemptionErrors = checkTaxExemption(merged);
    if (exemptionErrors) throw ApiError.validation(exemptionErrors);

    const data = { ...parsed.data, ...(merged.taxExempt ? {} : { taxExemptReason: null }) };
    const product = await productRepository.update(context.businessId, id, data);
    if (!product) throw ApiError.notFound("Product");
    return toProductDto(product);
  },

  async remove(context: BusinessContext, id: string): Promise<void> {
    if (!(await productRepository.softDelete(context.businessId, id))) throw ApiError.notFound("Product");
  },
};
