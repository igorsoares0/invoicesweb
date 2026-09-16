import { cn } from "cn";
import { MinusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FittedDocument } from "@/features/documents/fitted-document";
import { DocumentStyles, PrintedDocument } from "@/features/documents/document-templates";
import type { PublicEstimate as PublicEstimateData } from "@/server/services/public-estimate-service";
import { EstimateDecision } from "./estimate-decision";
import { Eyebrow, PhoneDocument } from "./phone-document";

/** Design d3: an expired estimate can still be downloaded, but not accepted. */
export function ExpiredEstimate({ estimate, pdfHref }: { estimate: PublicEstimateData; pdfHref: string }) {
  const contact = estimate.issuerEmail
    ? `mailto:${estimate.issuerEmail}?subject=${encodeURIComponent(`New estimate for ${estimate.number}`)}`
    : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f4f5] px-4 py-10">
      <div className="w-full max-w-[520px] rounded-xl border bg-card px-6 py-9 text-center shadow-card sm:px-10">
        <span className="mx-auto flex size-10 items-center justify-center rounded-[11px] bg-divider text-muted-2">
          <MinusIcon className="size-4" strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 text-[19px] font-semibold">This estimate has expired</h1>
        <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-muted-foreground">
          {estimate.number} was valid until {estimate.validUntil}. Prices may have changed since, so it can&apos;t be accepted
          from this link anymore.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a href={pdfHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Download the PDF
          </a>
          {contact ? (
            <a href={contact} className={buttonVariants({ size: "lg" })}>
              Ask for a new one
            </a>
          ) : null}
        </div>
        <p className="mt-6 border-t pt-5 text-[13px] text-muted-2">
          Sent by {estimate.issuerName}
          {estimate.issuerEmail ? ` · ${estimate.issuerEmail}` : ""}
        </p>
      </div>
    </main>
  );
}

function Outcome({ estimate }: { estimate: PublicEstimateData }) {
  if (estimate.state === "accepted") {
    return (
      <section role="status" className="mb-4 rounded-lg border border-success-border bg-success-tint px-5 py-4 text-success-ink print:hidden">
        <h2 className="font-semibold">{estimate.stateLabel}</h2>
        <p className="text-[14px]">{estimate.issuerName} will send an invoice with these prices. Nothing has been charged.</p>
      </section>
    );
  }
  if (estimate.state === "declined") {
    return (
      <section role="status" className="mb-4 rounded-lg border bg-card px-5 py-4 print:hidden">
        <h2 className="font-semibold">{estimate.stateLabel}</h2>
        <p className="text-[14px] text-muted-foreground">
          Changed your mind? Reply to {estimate.issuerEmail ?? estimate.issuerName} and they can reopen it.
        </p>
      </section>
    );
  }
  return null;
}

export function PublicEstimate({ estimate, token }: { estimate: PublicEstimateData; token: string }) {
  const pdfHref = `/e/${token}/pdf`;
  if (estimate.state === "expired") return <ExpiredEstimate estimate={estimate} pdfHref={pdfHref} />;
  const { view } = estimate;
  const awaiting = estimate.state === "awaiting";

  return (
    <div className="min-h-dvh bg-[#f4f4f5] print:bg-white">
      <DocumentStyles />
      <div className="sm:hidden">
        {!awaiting ? (
          <div className="px-4 pt-4">
            <Outcome estimate={estimate} />
          </div>
        ) : null}
        <PhoneDocument
          view={view}
          hero={
            <>
              <Eyebrow>Estimate total</Eyebrow>
              <p className="text-[34px] leading-tight font-bold">{view.totals.amountDue}</p>
              <p className="text-muted-foreground">Valid until {view.end}</p>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-mono text-[13px] text-muted-foreground">{view.number}</span>
                <span className="text-[13px] text-muted-foreground">{estimate.stateLabel}</span>
              </div>
            </>
          }
          actions={
            awaiting ? (
              <EstimateDecision token={token} issuerName={estimate.issuerName} layout="phone" />
            ) : (
              <a href={pdfHref} className={cn(buttonVariants({ size: "lg" }), "col-span-2 h-11 w-full")}>
                Download PDF
              </a>
            )
          }
        />
      </div>

      <main className="mx-auto hidden max-w-[808px] px-6 py-8 sm:block print:block print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <p>
            <span className="font-semibold">Estimate from {estimate.issuerName}</span>
            <span className="ml-3 text-muted-foreground">{estimate.stateLabel}</span>
          </p>
          <a href={pdfHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Download PDF
          </a>
        </div>
        {awaiting ? <EstimateDecision token={token} issuerName={estimate.issuerName} /> : <Outcome estimate={estimate} />}
        <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] print:rounded-none print:shadow-none">
          <FittedDocument>
            <PrintedDocument view={view} template={estimate.template} />
          </FittedDocument>
        </div>
        {estimate.issuerEmail ? (
          <p className="mt-5 text-center text-muted-foreground print:hidden">
            Questions before deciding? Reply to{" "}
            <a className="text-foreground underline-offset-2 hover:underline" href={`mailto:${estimate.issuerEmail}`}>
              {estimate.issuerEmail}
            </a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
