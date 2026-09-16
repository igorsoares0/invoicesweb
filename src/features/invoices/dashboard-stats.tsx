import Link from "next/link";
import type { DashboardDto } from "@/lib/api-types";
import { compareMoney, isZero, percentOf, subtractMoney } from "@/lib/documents/math";
import { formatMoney } from "@/lib/money";
import { pluralize } from "@/lib/format";
import { StatCard } from "@/components/documents/stat-card";

function monthDelta(stats: DashboardDto): { text: string; tone?: "success" } {
  const { amount, previousMonth } = stats.paidThisMonth;
  if (isZero(previousMonth)) return { text: isZero(amount) ? "Nothing recorded yet" : "First payments this month" };
  const change = percentOf(subtractMoney(amount, previousMonth).replace("-", ""), previousMonth);
  const up = compareMoney(amount, previousMonth) >= 0;
  return { text: `${up ? "+" : "−"}${change}% vs last month`, tone: up ? "success" : undefined };
}

export function DashboardStats({ stats, paymentTermsDays }: { stats: DashboardDto; paymentTermsDays: number }) {
  const money = (value: string) => formatMoney(value, stats.currency);
  const delta = monthDelta(stats);
  const currencyNote = stats.otherCurrencies.length ? ` · ${stats.currency} only` : "";
  return (
    <div className="flex flex-col gap-2">
      {stats.otherCurrencies.length ? (
        <p className="text-[12.5px] text-muted-foreground">
          Showing {stats.currency}. Each currency is reported on its own — nothing is converted.{" "}
          {stats.otherCurrencies.map((code) => (
            <Link key={code} href={`?currency=${code}`} className="mr-2 font-semibold text-primary">
              Show {code}
            </Link>
          ))}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Paid this month" value={money(stats.paidThisMonth.amount)} money hint={delta.text} tone={delta.tone} />
        <StatCard
          label="Outstanding"
          value={money(stats.outstanding.amount)}
          money
          hint={`Across ${pluralize(stats.outstanding.count, "invoice")}${currencyNote}`}
        />
        <StatCard
          label="Overdue"
          value={money(stats.overdue.amount)}
          money
          tone={stats.overdue.count ? "danger" : undefined}
          hint={
            stats.overdue.count
              ? `${pluralize(stats.overdue.count, "invoice")} · oldest ${stats.overdue.oldestDays}d`
              : "Nothing overdue"
          }
        />
        <StatCard
          label="Avg. days to pay"
          value={stats.averageDaysToPay === null ? "—" : String(stats.averageDaysToPay)}
          hint={`Net ${paymentTermsDays} terms`}
        />
      </div>
    </div>
  );
}
