import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListClientsQuery } from "@/lib/validation/client";
import { db } from "@/server/db";
import { isPrismaError } from "./prisma-errors";

/** Every query is scoped to one business and hides soft-deleted rows. */
function scope(businessId: string) {
  return { businessId, deletedAt: null } satisfies Prisma.ClientWhereInput;
}

export const clientRepository = {
  async list(businessId: string, query: ListClientsQuery) {
    const where: Prisma.ClientWhereInput = {
      ...scope(businessId),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { company: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await db.$transaction([
      db.client.findMany({
        where,
        orderBy: [{ [query.sort]: query.order }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      db.client.count({ where }),
    ]);
    return { items, total };
  },

  findById(businessId: string, id: string) {
    return db.client.findFirst({ where: { ...scope(businessId), id } });
  },

  create(businessId: string, data: Omit<Prisma.ClientUncheckedCreateInput, "businessId">) {
    return db.client.create({ data: { ...data, businessId } });
  },

  async update(businessId: string, id: string, data: Prisma.ClientUpdateInput) {
    try {
      return await db.client.update({ where: { ...scope(businessId), id }, data });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return null;
      throw error;
    }
  },

  async softDelete(businessId: string, id: string) {
    const result = await db.client.updateMany({
      where: { ...scope(businessId), id },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  },
};
