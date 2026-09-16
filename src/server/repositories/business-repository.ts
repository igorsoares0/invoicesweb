import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export const businessRepository = {
  findById(businessId: string) {
    return db.business.findUniqueOrThrow({ where: { id: businessId } });
  },

  findByUserId(userId: string) {
    return db.business.findUnique({ where: { userId } });
  },

  create(userId: string, data: Omit<Prisma.BusinessUncheckedCreateInput, "userId">) {
    return db.business.create({ data: { ...data, userId } });
  },

  update(businessId: string, data: Prisma.BusinessUpdateInput) {
    return db.business.update({ where: { id: businessId }, data });
  },
};
