import "server-only";
import type { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import type { ListInvoicesQuery } from "@/lib/validation/invoice";
import { db } from "@/server/db";

export type Tx = Prisma.TransactionClient;

export const invoiceDetailInclude = {
  client: { select: { id: true, name: true, email: true, deletedAt: true } },
  items: { orderBy: { position: "asc" } },
  payments: { orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }] },
  events: { orderBy: { createdAt: "desc" } },
  fromEstimate: { select: { id: true, number: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetail = Prisma.InvoiceGetPayload<{ include: typeof invoiceDetailInclude }>;

const OPEN: InvoiceStatus[] = ["SENT", "VIEWED", "PARTIALLY_PAID"];

/** `today` is the business's calendar date; overdue is decided against it. */
function filterWhere(filter: ListInvoicesQuery["status"], today: Date): Prisma.InvoiceWhereInput {
  const overdue: Prisma.InvoiceWhereInput = { status: { in: OPEN }, dueDate: { lt: today }, amountDue: { gt: 0 } };
  switch (filter) {
    case "draft":
      return { status: "DRAFT" };
    case "sent":
      return { status: { in: OPEN }, NOT: overdue };
    case "overdue":
      return overdue;
    case "paid":
      return { status: "PAID" };
    case "cancelled":
      return { status: "CANCELLED" };
    default:
      return {};
  }
}

const SORT_COLUMNS = {
  number: "sequence",
  dueDate: "dueDate",
  issueDate: "issueDate",
  total: "total",
  createdAt: "createdAt",
} as const;

export const invoiceRepository = {
  async list(businessId: string, query: ListInvoicesQuery, today: Date) {
    const where: Prisma.InvoiceWhereInput = {
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
      db.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          items: { select: { description: true }, orderBy: { position: "asc" }, take: 1 },
        },
        orderBy: [{ [SORT_COLUMNS[query.sort]]: query.order }, { sequence: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      db.invoice.count({ where }),
    ]);
    return { items, total };
  },

  count(businessId: string) {
    return db.invoice.count({ where: { businessId } });
  },

  findDetail(businessId: string, id: string, client: Tx | typeof db = db) {
    return client.invoice.findFirst({ where: { id, businessId }, include: invoiceDetailInclude });
  },

  findByPublicToken(token: string) {
    return db.invoice.findUnique({ where: { publicToken: token }, include: invoiceDetailInclude });
  },

  /** Row lock so concurrent payments or edits on one invoice serialize. */
  async lock(tx: Tx, businessId: string, id: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Invoice" WHERE id = ${id} AND "businessId" = ${businessId} FOR UPDATE`;
    return rows.length > 0;
  },

  /**
   * Reserves the next number in the business's continuous sequence. The UPDATE takes a row lock,
   * so concurrent drafts get distinct numbers; gaps appear only when drafts are deleted.
   */
  async reserveNumber(tx: Tx, businessId: string) {
    const [row] = await tx.$queryRaw<{ sequence: number; prefix: string }[]>`
      UPDATE "Business" SET "invoiceNextNumber" = "invoiceNextNumber" + 1, "updatedAt" = now()
      WHERE id = ${businessId}
      RETURNING "invoiceNextNumber" - 1 AS sequence, "invoicePrefix" AS prefix`;
    return row;
  },

  async maxSequence(businessId: string): Promise<number> {
    const result = await db.invoice.aggregate({ where: { businessId }, _max: { sequence: true } });
    return result._max.sequence ?? 0;
  },

  addEvent(tx: Tx, invoiceId: string, type: Prisma.InvoiceEventCreateManyInput["type"], metadata?: Prisma.InputJsonValue) {
    return tx.invoiceEvent.create({ data: { invoiceId, type, metadata } });
  },
};
