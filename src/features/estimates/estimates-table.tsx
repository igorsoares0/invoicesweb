import { cn } from "cn";
import { ReceiptTextIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/documents/status-badge";
import { EmptyState } from "@/components/list/empty-state";
import { Pagination } from "@/components/list/pagination";
import type { ApiList, EstimateListItemDto } from "@/lib/api-types";
import { formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { withSearchParams } from "@/lib/url";
import type { EstimateFilter } from "@/lib/validation/estimate";

const FILTERS: { value: EstimateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" },
];

const GRID = "md:grid-cols-[100px_minmax(0,1fr)_96px_100px_120px_116px]";

export function EstimatesTable({
  result,
  searchParams,
  filter,
  search,
  footer,
  emptyAction,
}: {
  result: ApiList<EstimateListItemDto>;
  searchParams: Record<string, string | undefined>;
  filter: EstimateFilter;
  search: ReactNode;
  footer?: ReactNode;
  emptyAction?: ReactNode;
}) {
  const { data: estimates, pagination } = result;
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card" aria-label="Estimates">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Estimates</h2>
        <nav aria-label="Filter estimates" className="-mx-1 flex gap-1 overflow-x-auto">
          {FILTERS.map((option) => (
            <Link
              key={option.value}
              href={withSearchParams("/estimates", searchParams, { status: option.value === "all" ? null : option.value, page: null })}
              aria-current={filter === option.value ? "true" : undefined}
              scroll={false}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-ink-3 hover:bg-divider",
                filter === option.value && "bg-foreground text-white hover:bg-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto w-full sm:w-auto">{search}</div>
      </div>

      {estimates.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={filter === "all" && !searchParams.q ? "No estimates yet" : "Nothing here"}
          body={
            filter === "all" && !searchParams.q
              ? "Send a price before the work starts. When the client accepts, it becomes an invoice in one click."
              : "No estimates match."
          }
          action={filter === "all" && !searchParams.q ? emptyAction : undefined}
        />
      ) : (
        <>
          <div
            role="row"
            className={cn("hidden h-9 items-center gap-3 border-b px-4 text-[11px] font-semibold tracking-[0.02em] text-muted-2 uppercase md:grid", GRID)}
          >
            <span>Number</span>
            <span>Client</span>
            <span>Issued</span>
            <span>Expires</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Status</span>
          </div>
          <ul aria-label="Estimates list">
            {estimates.map((estimate) => {
              const draft = estimate.status === "DRAFT";
              return (
                <li
                  key={estimate.id}
                  className={cn(
                    "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-divider px-4 py-3 last:border-b-0 md:min-h-[56px] md:py-2",
                    GRID,
                    draft && "bg-canvas-3",
                    estimate.displayStatus === "ACCEPTED" && "shadow-[inset_2px_0_0_var(--success)]",
                  )}
                >
                  <Link
                    href={`/estimates/${estimate.id}`}
                    className={cn("font-mono text-[13px] font-medium after:absolute after:inset-0", draft && "text-muted-2")}
                  >
                    {estimate.number}
                  </Link>
                  <span className={cn("col-start-1 row-start-2 min-w-0 md:col-auto md:row-auto", draft && "text-muted-2")}>
                    <span className="block truncate text-sm font-medium">{estimate.client?.name ?? "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted-2">{estimate.summary ?? "Untitled estimate"}</span>
                  </span>
                  <span className="hidden text-[13px] text-ink-3 md:block">{draft ? "—" : formatShortDate(estimate.issueDate)}</span>
                  <span
                    className={cn(
                      "hidden text-[13px] text-ink-3 md:block",
                      estimate.displayStatus === "EXPIRED" && "font-medium text-destructive",
                    )}
                  >
                    {draft ? "—" : formatShortDate(estimate.expiryDate)}
                  </span>
                  <span className={cn("col-start-2 row-start-1 text-right text-sm font-semibold md:col-auto md:row-auto", draft && "text-muted-2")}>
                    {formatMoney(estimate.total, estimate.currency)}
                  </span>
                  <span className="col-start-2 row-start-2 flex justify-end md:col-auto md:row-auto md:justify-center">
                    <StatusBadge status={estimate.displayStatus} />
                  </span>
                </li>
              );
            })}
          </ul>
          <Pagination pathname="/estimates" searchParams={searchParams} {...pagination} />
        </>
      )}
      {footer}
    </section>
  );
}
