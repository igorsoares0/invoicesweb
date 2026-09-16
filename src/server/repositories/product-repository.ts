import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListProductsQuery } from "@/lib/validation/product";
import { db } from "@/server/db";
import { isPrismaError } from "./prisma-errors";

function scope(businessId: string) {
  return { businessId, deletedAt: null } satisfies Prisma.ProductWhereInput;
}

export const productRepository = {
  async list(businessId: string, query: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      ...scope(businessId),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await db.$transaction([
      db.product.findMany({
        where,
        orderBy: [{ [query.sort]: query.order }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      db.product.count({ where }),
    ]);
    return { items, total };
  },

  findById(businessId: string, id: string) {
    return db.product.findFirst({ where: { ...scope(businessId), id } });
  },

  create(businessId: string, data: Omit<Prisma.ProductUncheckedCreateInput, "businessId">) {
    return db.product.create({ data: { ...data, businessId } });
  },

  async update(businessId: string, id: string, data: Prisma.ProductUpdateInput) {
    try {
      return await db.product.update({ where: { ...scope(businessId), id }, data });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return null;
      throw error;
    }
  },

  async softDelete(businessId: string, id: string) {
    const result = await db.product.updateMany({
      where: { ...scope(businessId), id },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  },
};
