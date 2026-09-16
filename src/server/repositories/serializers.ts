import type { BusinessDto, ClientDto, ProductDto } from "@/lib/api-types";
import type { Business, Client, Product } from "@/generated/prisma/client";

export function toBusinessDto(business: Business): BusinessDto {
  const { userId: _userId, ...rest } = business;
  return {
    ...rest,
    defaultTaxRate: business.defaultTaxRate?.toFixed(2) ?? null,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

export function toClientDto(client: Client): ClientDto {
  const { businessId: _businessId, deletedAt: _deletedAt, ...rest } = client;
  return {
    ...rest,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

export function toProductDto(product: Product): ProductDto {
  const { businessId: _businessId, deletedAt: _deletedAt, ...rest } = product;
  return {
    ...rest,
    unitPrice: product.unitPrice.toFixed(2),
    taxRate: product.taxRate.toFixed(2),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
