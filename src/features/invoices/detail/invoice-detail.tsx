"use client";

import { cn } from "cn";
import { ChevronLeftIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { ConfirmDeleteDialog } from "@/components/list/confirm-delete-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FittedDocument } from "@/features/documents/fitted-document";
import { DocumentStyles, InvoiceDocument } from "@/features/documents/invoice-document";
import { api } from "@/lib/api-client";
import type { InvoiceDto } from "@/lib/api-types";
import { daysBetween, formatDate, formatTimestamp } from "@/lib/dates";
import type { InvoiceView } from "@/lib/documents/view";
import { describeEvent, type EventTone } from "@/lib/invoices/events";
import { isZero, percentOf } from "@/lib/invoices/math";
import { canPerform } from "@/lib/invoices/status";
import { formatMoney } from "@/lib/money";
import { METHOD_LABELS, RecordPaymentDialog } from "./record-payment-dialog";

const DOT: Record<EventTone, string> = {
  success: "bg-success",
  info: "bg-primary",
  neutral: "bg-ink-3",
  muted: "bg-line-strong",
  danger: "bg-destructive",
};

function Card({ title, children, className, action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)} aria-label={title}>
      {title ? (
        <div className="flex items-center justify-between px-4 pt-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function InvoiceDetail({
  invoice: initial,
  view,
  timezone,
  today,
}: {
  invoice: InvoiceDto;
  view: InvoiceView;
  timezone: string;
  today: string;
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initial);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentToRemove, setPaymentToRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const money = (value: string) => formatMoney(value, invoice.currency);
  const canPay = canPerform(invoice.status, "recordPayment");
  const collected = percentOf(invoice.amountPaid, invoice.total);
  const publicUrl = invoice.publicToken ? `/i/${invoice.publicToken}` : null;
  const clientName = view.billTo?.name ?? invoice.client?.name ?? null;

  async function run(action: () => Promise<InvoiceDto>, success: string) {
    setBusy(true);
    try {
      setInvoice(await action());
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    const copy = await api.post<InvoiceDto>(`/invoices/${invoice.id}/duplicate`, {});
    toast.success(`${copy.number} was created from ${invoice.number}`);
    router.push(`/invoices/${copy.id}`);
  }

  const lateDays = daysBetween(invoice.dueDate, today);

  return (
    <>
      <DocumentStyles />
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
          <Link href="/invoices" className="hidden font-medium text-muted-2 hover:text-foreground sm:inline">
            Invoices
          </Link>
          <Link href="/invoices" className="text-muted-2 sm:hidden" aria-label="Back to invoices">
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="hidden text-line-strong sm:inline">/</span>
          <h1 className="font-mono text-[15px] font-semibold">{invoice.number}</h1>
          <InvoiceStatusBadge status={invoice.displayStatus} />
        </div>
        <div className="flex items-center gap-2">
          {canPay ? <Button onClick={() => setPaymentOpen(true)}>Record payment</Button> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={`/api/v1/invoices/${invoice.id}/pdf?download=1`}>Download PDF</a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={duplicate}>Duplicate</DropdownMenuItem>
              {canPay ? (
                <DropdownMenuItem
                  onSelect={() =>
                    run(() => api.post<InvoiceDto>(`/invoices/${invoice.id}/mark-paid`, {}), `${invoice.number} marked as paid`)
                  }
                >
                  Mark as paid in full
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-6 xl:flex-row xl:items-start">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <Card>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 md:grid-cols-[auto_auto_auto_minmax(120px,1fr)_auto] md:items-end">
              <div className="col-span-2 md:col-span-1">
                <p className="text-[13px] text-muted-2">Amount due</p>
                <p className="text-[30px] leading-tight font-semibold" data-testid="amount-due">
                  {money(invoice.amountDue)}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-muted-2">Paid</p>
                <p className="text-[18px] font-semibold text-success">{money(invoice.amountPaid)}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-2">Total</p>
                <p className="text-[18px] font-semibold">{money(invoice.total)}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-[12px] text-muted-2">{collected}% collected</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={collected} aria-valuemin={0} aria-valuemax={100} aria-label="Collected">
                  <div className="h-full rounded-full bg-success" style={{ width: `${collected}%` }} />
                </div>
              </div>
              <div className="md:text-right">
                <p className={cn("text-[13px] text-muted-2", invoice.displayStatus === "OVERDUE" && "text-destructive")}>
                  {invoice.displayStatus === "OVERDUE" ? `Overdue ${lateDays}d` : "Due"}
                </p>
                <p className="text-[15px] font-semibold">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>
          </Card>

          <Card
            title={`Payments${invoice.payments.length ? ` · ${invoice.payments.length}` : ""}`}
            action={
              canPay ? (
                <button type="button" className="text-[13px] font-semibold text-primary" onClick={() => setPaymentOpen(true)}>
                  + Record payment
                </button>
              ) : null
            }
          >
            {invoice.payments.length ? (
              <ul className="mt-2 border-t" aria-label="Payments list">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center gap-4 border-b border-divider px-4 py-3 last:border-b-0">
                    <span className="w-28 shrink-0 text-[13.5px]">{formatDate(payment.paymentDate)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">
                      {METHOD_LABELS[payment.method]}
                      {payment.reference ? <span className="font-mono text-[12px] text-muted-2"> · {payment.reference}</span> : null}
                    </span>
                    <span className="font-semibold">{money(payment.amount)}</span>
                    {canPerform(invoice.status, "removePayment") ? (
                      <button
                        type="button"
                        className="text-[12.5px] text-muted-2 hover:text-destructive"
                        onClick={() => setPaymentToRemove(payment.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pt-1 pb-4 text-[13.5px] text-muted-foreground">
                {invoice.status === "CANCELLED" ? "This invoice was cancelled." : "No payments recorded yet."}
              </p>
            )}
            {!isZero(invoice.amountDue) && invoice.payments.length && canPay ? (
              <p className="flex items-center gap-2 border-t px-4 py-3 text-[13px] text-muted-foreground">
                <span aria-hidden className="size-2 rounded-full bg-warning" />
                {money(invoice.amountDue)} still open. Recording the rest flips this invoice to{" "}
                <span className="font-semibold text-success">Paid</span> automatically.
              </p>
            ) : null}
          </Card>

          <Card title="Document">
            <div className="p-4">
              <div className="mx-auto max-w-[620px] overflow-hidden rounded-[4px] border shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <FittedDocument maxZoom={1}>
                  <InvoiceDocument view={view} template={invoice.template} />
                </FittedDocument>
              </div>
            </div>
          </Card>

          <Card title="History">
            <ol className="flex flex-col gap-2.5 px-4 pt-2 pb-4" aria-label="History">
              {invoice.events.map((event) => {
                const { label, tone } = describeEvent(event, invoice.currency);
                return (
                  <li key={event.id} className="flex items-center gap-3 text-[14px]">
                    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
                    <span className="flex-1">{label}</span>
                    <time className="font-mono text-[12px] text-muted-2" dateTime={event.createdAt}>
                      {formatTimestamp(event.createdAt, timezone)}
                    </time>
                  </li>
                );
              })}
            </ol>
          </Card>
        </main>

        <aside className="flex w-full flex-col gap-4 xl:sticky xl:top-[76px] xl:w-[290px] xl:shrink-0">
          <Card title="Invoice">
            <dl className="flex flex-col gap-1.5 px-4 pt-2 pb-4 text-[13.5px]">
              {[
                ["Client", clientName ?? "—"],
                ["Issued", formatDate(invoice.issueDate)],
                ["Currency", invoice.currency],
                ["Terms", view.termsLabel],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Actions">
            <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
              <a href={`/api/v1/invoices/${invoice.id}/pdf?download=1`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Download PDF
              </a>
              <Button variant="outline" size="lg" onClick={duplicate}>
                Duplicate
              </Button>
              {canPerform(invoice.status, "cancel") ? (
                <button
                  type="button"
                  className="mt-1 text-left text-[13.5px] font-semibold text-destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel invoice
                </button>
              ) : null}
            </div>
          </Card>

          {invoice.status !== "CANCELLED" ? (
            <Card title="Public link">
              <div className="px-4 pt-2 pb-4 text-[13.5px]">
                {publicUrl ? (
                  <>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="block truncate font-mono text-[12.5px] text-primary" data-testid="public-link">
                      {publicUrl}
                    </a>
                    <div className="mt-2 flex gap-3 text-muted-foreground">
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={async () => {
                          await navigator.clipboard.writeText(new URL(publicUrl, window.location.origin).toString());
                          toast.success("Link copied");
                        }}
                      >
                        Copy
                      </button>
                      <a href={publicUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                        Open
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        className="hover:text-destructive"
                        onClick={() =>
                          run(() => api.delete<InvoiceDto>(`/invoices/${invoice.id}/public-link`), "Public link revoked")
                        }
                      >
                        Revoke
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">The link was revoked. Anyone who opens the old one sees that it no longer works.</p>
                    <button
                      type="button"
                      disabled={busy}
                      className="mt-2 font-semibold text-primary"
                      onClick={() => run(() => api.post<InvoiceDto>(`/invoices/${invoice.id}/public-link`, {}), "New link created")}
                    >
                      Create a new link
                    </button>
                  </>
                )}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>

      {paymentOpen ? (
        <RecordPaymentDialog
          open
          onOpenChange={setPaymentOpen}
          invoice={invoice}
          clientName={clientName}
          today={today}
          onRecorded={(updated) => {
            setInvoice(updated);
            setPaymentOpen(false);
            toast.success(updated.status === "PAID" ? `${invoice.number} is paid` : "Payment recorded");
            router.refresh();
          }}
        />
      ) : null}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {invoice.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice stays in your records with its number, but the public link stops working and it can&apos;t be paid.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invoice</AlertDialogCancel>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={async () => {
                await run(() => api.post<InvoiceDto>(`/invoices/${invoice.id}/cancel`, {}), `${invoice.number} was cancelled`);
                setCancelOpen(false);
              }}
            >
              Cancel invoice
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDeleteDialog
        open={paymentToRemove !== null}
        onOpenChange={(open) => !open && setPaymentToRemove(null)}
        title="Remove this payment?"
        description="Use this for payments recorded by mistake. The balance and status are recalculated."
        onConfirm={async () => {
          if (!paymentToRemove) return;
          await run(() => api.delete<InvoiceDto>(`/invoices/${invoice.id}/payments/${paymentToRemove}`), "Payment removed");
        }}
      />
    </>
  );
}
