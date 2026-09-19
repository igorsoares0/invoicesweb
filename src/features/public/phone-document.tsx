import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { extractIban, formatIban } from "@/lib/documents/iban";
import type { DocumentView } from "@/lib/documents/view";
import { CopyButton } from "./public-actions";

export function Eyebrow({ children }: { children: string }) {
  return <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-2 uppercase">{children}</p>;
}

/**
 * Stacked cards for reading a document on a phone (design g4). The hero sits on top, the
 * action bar is fixed at the bottom; both come from the page because they differ by document.
 */
export function PhoneDocument({ view, hero, actions }: { view: DocumentView; hero: ReactNode; actions: ReactNode }) {
  const iban = extractIban(view.paymentInstructions);
  const scope = view.kind === "estimate" ? view.terms : null;
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-28 sm:hidden print:hidden">
      <div className="flex items-center gap-3 px-1">
        <LogoMark letter={view.issuer.initial} className="size-7" />
        <span className="font-medium">{view.issuer.name}</span>
      </div>
      <section className="rounded-xl border bg-card px-4 py-4">{hero}</section>
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
            <dt className="font-semibold">{view.labels.grandTotal}</dt>
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
      {scope ? (
        <section className="rounded-xl border bg-card px-4 py-4">
          <Eyebrow>Scope & terms</Eyebrow>
          <p className="whitespace-pre-line text-muted-foreground">{scope}</p>
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
      {view.branded ? <p className="text-center text-[12px] text-muted-2">Made with Invoice Maker</p> : null}
      <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {actions}
      </div>
    </div>
  );
}
