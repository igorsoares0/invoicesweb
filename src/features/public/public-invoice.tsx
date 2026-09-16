import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { FittedDocument } from "@/features/documents/fitted-document";
import { DocumentStyles, PrintedDocument } from "@/features/documents/document-templates";
import type { PublicInvoice as PublicInvoiceData, PublicTone } from "@/server/services/public-invoice-service";
import { Eyebrow, PhoneDocument } from "./phone-document";
import { PrintButton } from "./public-actions";

const TONES: Record<PublicTone, string> = {
  sent: "bg-primary-tint text-primary",
  partial: "bg-warning-tint text-warning",
  paid: "bg-success-tint text-success",
  overdue: "bg-danger-tint text-destructive",
};

function StatusPill({ invoice }: { invoice: PublicInvoiceData }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold", TONES[invoice.status.tone])}
    >
      {invoice.status.label}
    </span>
  );
}

function PhoneInvoice({ invoice, pdfHref }: { invoice: PublicInvoiceData; pdfHref: string }) {
  const { view } = invoice;
  return (
    <PhoneDocument
      view={view}
      hero={
        <>
          <Eyebrow>Amount due</Eyebrow>
          <p className="text-[34px] leading-tight font-bold">{view.totals.amountDue}</p>
          <p className="text-muted-foreground">
            by {view.end} · {view.termsLabel}
          </p>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="font-mono text-[13px] text-muted-foreground">{view.number}</span>
            <StatusPill invoice={invoice} />
          </div>
        </>
      }
      actions={
        <>
          <PrintButton className="h-11 w-full" />
          <a href={pdfHref} className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}>
            Download PDF
          </a>
        </>
      }
    />
  );
}

export function PublicInvoice({ invoice, token }: { invoice: PublicInvoiceData; token: string }) {
  const pdfHref = `/i/${token}/pdf`;
  return (
    <div className="min-h-dvh bg-[#f4f4f5] print:bg-white">
      <DocumentStyles />
      <PhoneInvoice invoice={invoice} pdfHref={pdfHref} />
      <main className="mx-auto hidden max-w-[808px] px-6 py-8 sm:block print:block print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <StatusPill invoice={invoice} />
            <span className="text-muted-foreground">{invoice.dueLabel}</span>
          </div>
          <div className="flex gap-2">
            <PrintButton />
            <a href={pdfHref} className={buttonVariants({ size: "lg" })}>
              Download PDF
            </a>
          </div>
        </div>
        <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] print:rounded-none print:shadow-none">
          <FittedDocument>
            <PrintedDocument view={invoice.view} template={invoice.template} />
          </FittedDocument>
        </div>
        {invoice.issuerEmail ? (
          <p className="mt-5 text-center text-muted-foreground print:hidden">
            Questions? Reply to{" "}
            <a className="text-foreground underline-offset-2 hover:underline" href={`mailto:${invoice.issuerEmail}`}>
              {invoice.issuerEmail}
            </a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
