import { cn } from "cn";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { FittedDocument } from "@/features/documents/fitted-document";
import { DocumentStyles, InvoiceDocument } from "@/features/documents/invoice-document";
import { extractIban, formatIban } from "@/lib/documents/iban";
import type { PublicInvoice as PublicInvoiceData, PublicTone } from "@/server/services/public-invoice-service";
import { CopyButton, PrintButton } from "./public-actions";

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

function Eyebrow({ children }: { children: string }) {
  return <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-2 uppercase">{children}</p>;
}

/** Phone layout (g4): the most-viewed screen in the product, opened from email on a phone. */
function PhoneInvoice({ invoice, pdfHref }: { invoice: PublicInvoiceData; pdfHref: string }) {
  const { view } = invoice;
  const iban = extractIban(view.paymentInstructions);
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-28 sm:hidden print:hidden">
      <div className="flex items-center gap-3 px-1">
        <LogoMark letter={view.issuer.initial} className="size-7" />
        <span className="font-medium">{view.issuer.name}</span>
      </div>
      <section className="rounded-xl border bg-card px-4 py-4">
        <Eyebrow>Amount due</Eyebrow>
        <p className="text-[34px] leading-tight font-bold">{view.totals.amountDue}</p>
        <p className="text-muted-foreground">
          by {view.due} · {view.termsLabel}
        </p>
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="font-mono text-[13px] text-muted-foreground">{view.number}</span>
          <StatusPill invoice={invoice} />
        </div>
      </section>
      <section className="rounded-xl border bg-card px-4 py-4">
        <Eyebrow>Items</Eyebrow>
        <ul className="flex flex-col">
          {view.lines.map((line, index) => (
            <li key={index} className="border-b border-divider py-2.5 last:border-b-0">
              <p className="text-[15px]">{line.description}</p>
              <div className="flex items-end justify-between gap-3">
                <span className="text-[13px] text-muted-foreground">
                  {line.quantity} × {line.rate ?? "—"}
                  {line.adjustment ? ` − ${line.adjustment}` : ""}
                </span>
                <span className="font-semibold">{line.amountMoney}</span>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-2 flex flex-col gap-1 border-t pt-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{view.totals.subtotal}</dd>
          </div>
          {view.totals.discount ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd>{view.totals.discount}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{view.totals.taxLabel}</dt>
            <dd>{view.totals.tax}</dd>
          </div>
          {view.totals.amountPaid ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd>−{view.totals.amountPaid}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex items-baseline justify-between border-t border-foreground pt-2">
            <dt className="font-semibold">Total due</dt>
            <dd className="text-[20px] font-bold">{view.totals.amountDue}</dd>
          </div>
        </dl>
      </section>
      {view.paymentInstructions ? (
        <section className="rounded-xl border bg-card px-4 py-4">
          <Eyebrow>How to pay</Eyebrow>
          <p className="whitespace-pre-line">{view.paymentInstructions}</p>
          {iban ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-divider px-3 py-2.5">
              <span className="truncate font-mono text-[13px]">{formatIban(iban)}</span>
              <CopyButton value={iban} />
            </div>
          ) : null}
        </section>
      ) : null}
      {view.notes ? (
        <section className="rounded-xl border bg-card px-4 py-4">
          <Eyebrow>Notes</Eyebrow>
          <p className="whitespace-pre-line text-muted-foreground">{view.notes}</p>
        </section>
      ) : null}
      <section className="rounded-xl border bg-card px-4 py-4 text-muted-foreground">
        <p className="font-semibold text-foreground">{view.issuer.name}</p>
        {view.issuer.address ? <p>{view.issuer.address}</p> : null}
        <p>{[view.issuer.email, view.issuer.taxId ? `VAT ${view.issuer.taxId}` : null].filter(Boolean).join(" · ")}</p>
      </section>
      <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <PrintButton className="h-11 w-full" />
        <a href={pdfHref} className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}>
          Download PDF
        </a>
      </div>
    </div>
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
            <InvoiceDocument view={invoice.view} template={invoice.template} />
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
