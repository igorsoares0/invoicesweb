import "server-only";
import type { EstimateStatus, Prisma } from "@/generated/prisma/client";
import type { ListEstimatesQuery } from "@/lib/validation/estimate";
import { db } from "@/server/db";
import type { Tx } from "./invoice-repository";

export const estimateDetailInclude = {
  client: { select: { id: true, name: true, email: true, deletedAt: true } },
  items: { orderBy: { position: "asc" } },
  events: { orderBy: { createdAt: "desc" } },
  convertedInvoice: { select: { id: true, number: true } },
} satisfies Prisma.EstimateInclude;

export type EstimateDetail = Prisma.EstimateGetPayload<{ include: typeof estimateDetailInclude }>;

const AWAITING: EstimateStatus[] = ["SENT", "VIEWED"];

function filterWhere(filter: ListEstimatesQuery["status"], today: Date): Prisma.EstimateWhereInput {
  const expired: Prisma.EstimateWhereInput = { status: { in: AWAITING }, expiryDate: { lt: today } };
  switch (filter) {
    case "draft":
      return { status: "DRAFT" };
    case "sent":
      return { status: { in: AWAITING }, expiryDate: { gte: today } };
    case "accepted":
      return { status: "ACCEPTED" };
    case "declined":
      return { status: "DECLINED" };
    case "expired":
      return expired;
    case "converted":
      return { status: "CONVERTED" };
    default:
      return {};
  }
}

const SORT_COLUMNS = {
  number: "sequence",
  expiryDate: "expiryDate",
  issueDate: "issueDate",
  total: "total",
  createdAt: "createdAt",
} as const;

export const estimateRepository = {
  async list(businessId: string, query: ListEstimatesQuery, today: Date) {
    const where: Prisma.EstimateWhereInput = {
      businessId,
      ...filterWhere(query.status, today),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: "insensitive" } },
              { client: { name: { contains: query.q, mode: "insensitive" } } },
              { items: { some: { description: { contains: query.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await db.$transaction([
      db.estimate.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          items: { select: { description: true }, orderBy: { position: "asc" }, take: 1 },
        },
        orderBy: [{ [SORT_COLUMNS[query.sort]]: query.order }, { sequence: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      db.estimate.count({ where }),
    ]);
    return { items, total };
  },

  count(businessId: string) {
    return db.estimate.count({ where: { businessId } });
  },

  findDetail(businessId: string, id: string, client: Tx | typeof db = db) {
    return client.estimate.findFirst({ where: { id, businessId }, include: estimateDetailInclude });
  },

  findByPublicToken(token: string) {
    return db.estimate.findUnique({ where: { publicToken: token }, include: estimateDetailInclude });
  },

  async lock(tx: Tx, businessId: string, id: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Estimate" WHERE id = ${id} AND "businessId" = ${businessId} FOR UPDATE`;
    return rows.length > 0;
  },

  /** Estimates have their own continuous sequence (spec §33), assigned when the draft is created. */
  async reserveNumber(tx: Tx, businessId: string) {
    const [row] = await tx.$queryRaw<{ sequence: number; prefix: string; validity: number }[]>`
      UPDATE "Business" SET "estimateNextNumber" = "estimateNextNumber" + 1, "updatedAt" = now()
      WHERE id = ${businessId}
      RETURNING "estimateNextNumber" - 1 AS sequence, "estimatePrefix" AS prefix, "estimateValidityDays" AS validity`;
    return row;
  },

  async maxSequence(businessId: string): Promise<number> {
    const result = await db.estimate.aggregate({ where: { businessId }, _max: { sequence: true } });
    return result._max.sequence ?? 0;
  },

  addEvent(tx: Tx, estimateId: string, type: Prisma.EstimateEventCreateManyInput["type"], metadata?: Prisma.InputJsonValue) {
    return tx.estimateEvent.create({ data: { estimateId, type, metadata } });
  },
};
