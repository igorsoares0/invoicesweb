"use client";

import { cn } from "cn";
import { ChevronLeftIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DetailCard } from "@/features/documents/detail/detail-card";
import { PublicLinkCard } from "@/features/documents/detail/public-link-card";
import { FittedDocument } from "@/features/documents/fitted-document";
import { DocumentStyles, PrintedDocument } from "@/features/documents/document-templates";
import { api } from "@/lib/api-client";
import type { EstimateDto } from "@/lib/api-types";
import { daysBetween, formatLongDate, formatShortDate, formatTimestamp } from "@/lib/dates";
import type { DocumentView } from "@/lib/documents/view";
import { describeEstimateEvent } from "@/lib/estimates/events";
import { canPerformEstimate } from "@/lib/estimates/status";
import type { EventTone } from "@/lib/invoices/events";
import { ConvertDialog } from "./convert-dialog";

const DOT: Record<EventTone, string> = {
  success: "bg-success",
  info: "bg-primary",
  neutral: "bg-ink-3",
  muted: "bg-line-strong",
  danger: "bg-destructive",
};

const dateOf = (iso: string | null) => (iso ? formatShortDate(iso.slice(0, 10)) : "");

function StateBanner({
  estimate,
  today,
  clientName,
  canConvert,
  busy,
  onConvert,
  onReopen,
  onDuplicate,
}: {
  estimate: EstimateDto;
  today: string;
  clientName: string | null;
  canConvert: boolean;
  busy: boolean;
  onConvert: () => void;
  onReopen: () => void;
  onDuplicate: () => void;
}) {
  const who = estimate.respondedBy === "you" ? "You recorded the reply" : `${clientName ?? "The client"} replied on the public page`;
  switch (estimate.displayStatus) {
    case "ACCEPTED":
      return (
        <section role="status" className="rounded-lg border border-success-border bg-success-tint px-4 py-3.5 text-success-ink">
          <p className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            {estimate.respondedBy === "you" ? "Marked accepted" : "Accepted by client"}
          </p>
          <p className="mt-1 text-[13.5px]">
            {who} on {dateOf(estimate.acceptedAt)}. Nothing has been invoiced from it yet.
          </p>
          <Button className="mt-3 w-full" size="lg" onClick={onConvert} disabled={!canConvert}>
            Convert to invoice
          </Button>
        </section>
      );
    case "CONVERTED":
      return (
        <section role="status" className="rounded-lg border border-[#ddd6fe] bg-[#f5f3ff] px-4 py-3.5 text-[#5b21b6]">
          {estimate.convertedInvoice ? (
            <>
              <p className="font-semibold">Converted to {estimate.convertedInvoice.number}</p>
              <p className="mt-1 text-[13.5px]">This estimate is kept as it was accepted.</p>
              <Link href={`/invoices/${estimate.convertedInvoice.id}`} className={cn(buttonVariants({ size: "lg", variant: "outline" }), "mt-3 w-full")}>
                Open invoice
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold">The invoice was deleted</p>
              <p className="mt-1 text-[13.5px]">Convert again to create a new draft from this estimate.</p>
              <Button className="mt-3 w-full" size="lg" onClick={onConvert}>
                Convert again
              </Button>
            </>
          )}
        </section>
      );
    case "DECLINED":
      return (
        <section role="status" className="rounded-lg border border-danger-border bg-danger-tint px-4 py-3.5 text-danger-ink">
          <p className="font-semibold">{estimate.respondedBy === "you" ? "Marked declined" : "Declined by client"}</p>
          <p className="mt-1 text-[13.5px]">
            {who} on {dateOf(estimate.declinedAt)}.
          </p>
          {canPerformEstimate(estimate, "reopen", today) ? (
            <Button variant="outline" className="mt-3 w-full" size="lg" disabled={busy} onClick={onReopen}>
              Reopen for a reply
            </Button>
          ) : null}
        </section>
      );
    case "EXPIRED":
      return (
        <section role="status" className="rounded-lg border bg-[#fafafa] px-4 py-3.5">
          <p className="font-semibold">Expired on {formatLongDate(estimate.expiryDate)}</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            It can&apos;t be accepted anymore. Duplicate it to send fresh dates and prices.
          </p>
          <Button variant="outline" className="mt-3 w-full" size="lg" onClick={onDuplicate}>
            Duplicate
          </Button>
        </section>
      );
    default: {
      const days = daysBetween(today, estimate.expiryDate);
      return (
        <section role="status" className="rounded-lg border border-[#c7d2fe] bg-primary-tint px-4 py-3.5 text-primary">
          <p className="font-semibold">Waiting for a reply</p>
          <p className="mt-1 text-[13.5px]">
            Sent {dateOf(estimate.sentAt)}
            {estimate.viewedAt ? ` · viewed ${dateOf(estimate.viewedAt)}` : ""} · {days === 0 ? "expires today" : `expires in ${days} day${days === 1 ? "" : "s"}`}
          </p>
        </section>
      );
    }
  }
}

export function EstimateDetail({
  estimate: initial,
  view,
  timezone,
  today,
  nextInvoiceNumber,
  paymentTermsDays,
  openConvert,
}: {
  estimate: EstimateDto;
  view: DocumentView;
  timezone: string;
  today: string;
  nextInvoiceNumber: string;
  paymentTermsDays: number;
  openConvert: boolean;
}) {
  const router = useRouter();
  const [estimate, setEstimate] = useState(initial);
  const [busy, setBusy] = useState(false);
  const canConvert = canPerformEstimate(estimate, "convert", today);
  const [convertOpen, setConvertOpen] = useState(openConvert && canConvert);
  const clientName = view.billTo?.name ?? estimate.client?.name ?? null;
  const awaiting = canPerformEstimate(estimate, "accept", today);

  async function run(action: () => Promise<EstimateDto>, success: string) {
    setBusy(true);
    try {
      setEstimate(await action());
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    const copy = await api.post<EstimateDto>(`/estimates/${estimate.id}/duplicate`, {});
    toast.success(`${copy.number} was created from ${estimate.number}`);
    router.push(`/estimates/${copy.id}`);
  }

  return (
    <>
      <DocumentStyles />
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
          <Link href="/estimates" className="hidden font-medium text-muted-2 hover:text-foreground sm:inline">
            Estimates
          </Link>
          <Link href="/estimates" className="text-muted-2 sm:hidden" aria-label="Back to estimates">
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="hidden text-line-strong sm:inline">/</span>
          <h1 className="font-mono text-[15px] font-semibold">{estimate.number}</h1>
          <StatusBadge status={estimate.displayStatus} />
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/estimates/${estimate.id}/pdf?download=1`}
            className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}
          >
            Download PDF
          </a>
          {canConvert ? <Button onClick={() => setConvertOpen(true)}>Convert to invoice</Button> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className="sm:hidden">
                <a href={`/api/v1/estimates/${estimate.id}/pdf?download=1`}>Download PDF</a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={duplicate}>Duplicate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col-reverse gap-4 px-4 py-5 sm:px-6 xl:flex-row xl:items-start">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <DetailCard title="Document">
            <div className="p-4">
              <div className="mx-auto max-w-[620px] overflow-hidden rounded-[4px] border shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <FittedDocument maxZoom={1}>
                  <PrintedDocument view={view} template={estimate.template} />
                </FittedDocument>
              </div>
            </div>
          </DetailCard>
        </main>

        <aside className="flex w-full flex-col gap-4 xl:sticky xl:top-[76px] xl:w-[300px] xl:shrink-0">
          <StateBanner
            estimate={estimate}
            today={today}
            clientName={clientName}
            canConvert={canConvert}
            busy={busy}
            onConvert={() => setConvertOpen(true)}
            onReopen={() => run(() => api.post<EstimateDto>(`/estimates/${estimate.id}/reopen`, {}), "Estimate reopened")}
            onDuplicate={duplicate}
          />

          <DetailCard title="Status">
            <ol className="flex flex-col gap-2.5 px-4 pt-2 pb-4" aria-label="Status history">
              {estimate.events.map((event) => {
                const { label, tone } = describeEstimateEvent(event);
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
          </DetailCard>

          {awaiting ? (
            <DetailCard title="Record the reply yourself">
              <div className="px-4 pt-2 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => api.post<EstimateDto>(`/estimates/${estimate.id}/accept`, {}), "Marked as accepted")}
                  >
                    Mark accepted
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => api.post<EstimateDto>(`/estimates/${estimate.id}/decline`, {}), "Marked as declined")}
                  >
                    Mark declined
                  </Button>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">For when the client answers by email or phone instead of the link.</p>
              </div>
            </DetailCard>
          ) : null}

          <PublicLinkCard
            path={estimate.publicToken ? `/e/${estimate.publicToken}` : null}
            busy={busy}
            onRevoke={() => run(() => api.delete<EstimateDto>(`/estimates/${estimate.id}/public-link`), "Public link revoked")}
            onCreate={() => run(() => api.post<EstimateDto>(`/estimates/${estimate.id}/public-link`, {}), "New link created")}
          />
        </aside>
      </div>

      <ConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        estimate={estimate}
        clientName={clientName}
        nextInvoiceNumber={nextInvoiceNumber}
        paymentTermsDays={paymentTermsDays}
        today={today}
      />
    </>
  );
}
