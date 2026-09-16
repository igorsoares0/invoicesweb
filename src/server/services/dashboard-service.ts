import "server-only";
import type { DashboardDto } from "@/lib/api-types";
import { daysBetween, fromIsoDate, todayIn, toIsoDate } from "@/lib/dates";
import { isCurrencyCode } from "@/lib/currencies";
import type { BusinessContext } from "@/server/auth/types";
import { db } from "@/server/db";
import { businessRepository } from "@/server/repositories/business-repository";

const OPEN = ["SENT", "VIEWED", "PARTIALLY_PAID"] as const;

function monthStarts(today: string) {
  const [year, month] = today.split("-").map(Number);
  const pad = (value: number) => String(value).padStart(2, "0");
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return { current: `${year}-${pad(month)}-01`, previous: `${previousYear}-${pad(previousMonth)}-01` };
}

const sum = (value: { toFixed(digits: number): string } | null) => value?.toFixed(2) ?? "0.00";

/**
 * Overview numbers for one currency. Currencies are never converted or added together
 * (a locked product decision); the UI lists the other currencies separately.
 */
export const dashboardService = {
  async get(context: BusinessContext, requestedCurrency?: string | null): Promise<DashboardDto> {
    const business = await businessRepository.findById(context.businessId);
    const today = todayIn(business.timezone);
    const currency =
      requestedCurrency && isCurrencyCode(requestedCurrency.toUpperCase())
        ? requestedCurrency.toUpperCase()
        : business.defaultCurrency;
    const months = monthStarts(today);
    const invoiceScope = { businessId: context.businessId, currency };

    const [paidThisMonth, paidPreviousMonth, outstanding, overdue, recentlyPaid, currencies] = await Promise.all([
      db.payment.aggregate({
        where: { currency, invoice: { businessId: context.businessId }, paymentDate: { gte: fromIsoDate(months.current) } },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          currency,
          invoice: { businessId: context.businessId },
          paymentDate: { gte: fromIsoDate(months.previous), lt: fromIsoDate(months.current) },
        },
        _sum: { amount: true },
      }),
      db.invoice.aggregate({
        where: { ...invoiceScope, status: { in: [...OPEN] } },
        _sum: { amountDue: true },
        _count: true,
      }),
      db.invoice.aggregate({
        where: { ...invoiceScope, status: { in: [...OPEN] }, dueDate: { lt: fromIsoDate(today) }, amountDue: { gt: 0 } },
        _sum: { amountDue: true },
        _count: true,
        _min: { dueDate: true },
      }),
      db.invoice.findMany({
        where: { ...invoiceScope, status: "PAID" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { issueDate: true, payments: { select: { paymentDate: true }, orderBy: { paymentDate: "desc" }, take: 1 } },
      }),
      db.invoice.findMany({
        where: { businessId: context.businessId, status: { not: "CANCELLED" } },
        distinct: ["currency"],
        select: { currency: true },
      }),
    ]);

    const payDays = recentlyPaid
      .filter((invoice) => invoice.payments.length > 0)
      .map((invoice) => Math.max(0, daysBetween(toIsoDate(invoice.issueDate), toIsoDate(invoice.payments[0].paymentDate))));

    return {
      currency,
      otherCurrencies: currencies.map((row) => row.currency).filter((code) => code !== currency).sort(),
      paidThisMonth: { amount: sum(paidThisMonth._sum.amount), previousMonth: sum(paidPreviousMonth._sum.amount) },
      outstanding: { amount: sum(outstanding._sum.amountDue), count: outstanding._count },
      overdue: {
        amount: sum(overdue._sum.amountDue),
        count: overdue._count,
        oldestDays: overdue._min.dueDate ? daysBetween(toIsoDate(overdue._min.dueDate), today) : null,
      },
      averageDaysToPay: payDays.length ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length) : null,
    };
  },
};
