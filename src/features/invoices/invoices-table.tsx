import { cn } from "cn";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/documents/status-badge";
import { EmptyState } from "@/components/list/empty-state";
import { Pagination } from "@/components/list/pagination";
import type { ApiList, InvoiceListItemDto } from "@/lib/api-types";
import { formatDate, formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { withSearchParams } from "@/lib/url";
import type { InvoiceFilter } from "@/lib/validation/invoice";
import { InvoiceRowActions } from "./invoice-row-actions";

const FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

const GRID = "md:grid-cols-[104px_minmax(0,1fr)_112px_92px_120px_124px_28px]";

export function InvoicesTable({
  result,
  pathname,
  searchParams,
  filter,
  title = "Invoices",
  emptyAction,
  paginate = true,
  footer,
}: {
  result: ApiList<InvoiceListItemDto>;
  pathname: string;
  searchParams: Record<string, string | undefined>;
  filter: InvoiceFilter;
  title?: string;
  emptyAction?: ReactNode;
  paginate?: boolean;
  footer?: ReactNode;
}) {
  const { data: invoices, pagination } = result;
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card" aria-label={title}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <nav aria-label="Filter invoices" className="-mx-1 flex gap-1 overflow-x-auto">
          {FILTERS.map((option) => (
            <Link
              key={option.value}
              href={withSearchParams(pathname, searchParams, { status: option.value === "all" ? null : option.value, page: null })}
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
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title={filter === "all" ? "No invoices yet" : "Nothing here"}
          body={
            filter === "all"
              ? "Create a draft, pick a client and add a few lines. It gets its number right away."
              : "No invoices match this filter."
          }
          action={filter === "all" ? emptyAction : undefined}
        />
      ) : (
        <>
          <div
            role="row"
            className={cn(
              "hidden h-9 items-center gap-3 border-b px-4 text-[11px] font-semibold tracking-[0.02em] text-muted-2 uppercase md:grid",
              GRID,
            )}
          >
            <span>Number</span>
            <span>Client</span>
            <span>Issued</span>
            <span>Due</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Status</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul aria-label="Invoices list">
            {invoices.map((invoice) => {
              const draft = invoice.status === "DRAFT";
              const overdue = invoice.displayStatus === "OVERDUE";
              return (
                <li
                  key={invoice.id}
                  className={cn(
                    "relative grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-x-3 gap-y-0.5 border-b border-divider px-4 py-3 last:border-b-0 md:min-h-[52px] md:py-2",
                    GRID,
                    draft && "bg-canvas-3",
                  )}
                >
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className={cn("font-mono text-[13px] font-medium after:absolute after:inset-0", draft && "text-muted-2")}
                  >
                    {invoice.number}
                  </Link>
                  <span className={cn("col-start-1 row-start-2 min-w-0 truncate text-sm md:col-auto md:row-auto", draft && "text-muted-2")}>
                    <span className="font-medium">{invoice.client?.name ?? "No client"}</span>
                    <span className="text-muted-2"> · {invoice.summary ?? "No items yet"}</span>
                  </span>
                  <span className="hidden text-[13px] text-ink-3 md:block">{draft ? "—" : formatDate(invoice.issueDate)}</span>
                  <span className={cn("hidden text-[13px] text-ink-3 md:block", overdue && "font-medium text-destructive")}>
                    {draft ? "—" : formatShortDate(invoice.dueDate)}
                  </span>
                  <span
                    className={cn(
                      "col-start-2 row-start-1 text-right text-sm font-semibold md:col-auto md:row-auto",
                      draft && "font-medium text-muted-2",
                    )}
                  >
                    {formatMoney(invoice.total, invoice.currency)}
                  </span>
                  <span className="col-start-2 row-start-2 flex justify-end md:col-auto md:row-auto md:justify-center">
                    <StatusBadge status={invoice.displayStatus} />
                  </span>
                  <span className="col-start-3 row-span-2 row-start-1 md:col-auto md:row-auto md:row-span-1">
                    <InvoiceRowActions invoice={invoice} />
                  </span>
                </li>
              );
            })}
          </ul>
          {paginate ? <Pagination pathname={pathname} searchParams={searchParams} {...pagination} /> : null}
        </>
      )}
      {footer}
    </section>
  );
}
