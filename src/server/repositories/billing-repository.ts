import "server-only";
import { db } from "@/server/db";
import type { Tx } from "./invoice-repository";

type Client = Tx | typeof db;

export const billingRepository = {
  subscriptionsOf(userId: string, client: Client = db) {
    return client.subscription.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  },

  /**
   * Invoices sent in the calendar month that contains `now`, in the business's timezone, and
   * the first day of the next month. Done in SQL: `sentAt` is stored as UTC without a zone, so
   * the local month boundaries are converted back to UTC before comparing.
   */
  async sentThisMonth(businessId: string, now: Date, client: Client = db): Promise<{ sent: number; resetsOn: string }> {
    const [row] = await client.$queryRaw<{ sent: number; resetsOn: string }[]>`
      WITH business AS (SELECT timezone FROM "Business" WHERE id = ${businessId}),
      bounds AS (
        SELECT
          date_trunc('month', ${now}::timestamptz AT TIME ZONE business.timezone) AS local_start,
          business.timezone AS tz
        FROM business
      )
      SELECT
        (SELECT count(*)::int FROM "Invoice" i
          WHERE i."businessId" = ${businessId}
            AND i."sentAt" >= (bounds.local_start AT TIME ZONE bounds.tz) AT TIME ZONE 'UTC'
            AND i."sentAt" < ((bounds.local_start + interval '1 month') AT TIME ZONE bounds.tz) AT TIME ZONE 'UTC'
        ) AS sent,
        to_char(bounds.local_start + interval '1 month', 'YYYY-MM-DD') AS "resetsOn"
      FROM bounds`;
    return row;
  },

  /**
   * Serialises sends within one business so the monthly count can't be raced. NO KEY UPDATE is
   * enough to exclude another send (and number reservation) without blocking the foreign-key
   * checks of every insert that points at this business.
   */
  async lockBusiness(tx: Tx, businessId: string) {
    await tx.$executeRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR NO KEY UPDATE`;
  },
};
