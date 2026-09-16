import type { CSSProperties, ReactNode } from "react";
import type { DocumentTemplate } from "@/lib/api-types";
import type { DocumentParty, DocumentView } from "@/lib/documents/view";
import { DOCUMENT_CSS } from "./document-styles";

type TemplateProps = { view: DocumentView };

/** Injects the template CSS once per document tree. */
export function DocumentStyles() {
  return <style dangerouslySetInnerHTML={{ __html: DOCUMENT_CSS }} />;
}

function Logo({ party }: { party: DocumentParty }) {
  return (
    <div className="logo" aria-hidden>
      {party.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to static HTML for the PDF too
        <img src={party.logoUrl} alt="" />
      ) : (
        party.initial
      )}
    </div>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="muted">
          {line}
        </p>
      ))}
    </>
  );
}

function partyLines(party: DocumentParty, options: { email?: boolean; tax?: boolean } = {}) {
  return [
    party.address ?? "",
    options.email === false ? "" : (party.email ?? ""),
    options.tax && party.taxId ? `Tax ID ${party.taxId}` : "",
  ];
}

function Description({ line }: { line: DocumentView["lines"][number] }) {
  return (
    <>
      {line.description || <span className="muted">—</span>}
      {line.adjustment ? <span className="adjust"> − {line.adjustment}</span> : null}
      {line.exempt ? <span className="exempt-tag"> · VAT exempt</span> : null}
    </>
  );
}

function LineTable({ view, index = false }: { view: DocumentView; index?: boolean }) {
  return (
    <table className="lines">
      <thead>
        <tr>
          {index ? <th className="index">#</th> : null}
          <th>Description</th>
          <th className="num">Qty</th>
          <th className="num">Rate</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {view.lines.map((line, position) => (
          <tr key={position}>
            {index ? <td className="index">{position + 1}</td> : null}
            <td>
              <Description line={line} />
            </td>
            <td className="num">{line.quantity}</td>
            <td className="num">{line.rate ?? "—"}</td>
            <td className="num strong">{line.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ view, grandLabel, children }: { view: DocumentView; grandLabel?: string; children?: ReactNode }) {
  const { totals } = view;
  return (
    <div className="totals avoid">
      <div className="totals-row">
        <span>Subtotal</span>
        <span>{totals.subtotal}</span>
      </div>
      {totals.discount ? (
        <div className="totals-row">
          <span>Discount</span>
          <span>{totals.discount}</span>
        </div>
      ) : null}
      <div className="totals-row">
        <span>{totals.taxLabel}</span>
        <span>{totals.tax}</span>
      </div>
      {totals.amountPaid ? (
        <>
          <div className="totals-row">
            <span>Total</span>
            <span>{totals.total}</span>
          </div>
          <div className="totals-row">
            <span>Paid</span>
            <span>−{totals.amountPaid}</span>
          </div>
        </>
      ) : null}
      <div className="totals-row grand">
        <span>{grandLabel ?? view.labels.grandTotal}</span>
        <span>{totals.amountPaid ? totals.amountDue : totals.total}</span>
      </div>
      {children}
    </div>
  );
}

/** Invoices ask how to pay; estimates spell out the scope and terms being agreed to. */
function leadBlock(view: DocumentView, payLabel: string): { label: string; text: string } | null {
  if (view.kind === "estimate") return view.terms ? { label: "Scope & terms", text: view.terms } : null;
  return view.paymentInstructions ? { label: payLabel, text: view.paymentInstructions } : null;
}

function Footnotes({ view }: { view: DocumentView }) {
  const terms = view.kind === "invoice" ? view.terms : null;
  if (!view.exemptions.length && !terms) return null;
  return (
    <div className="footnotes avoid">
      {view.exemptions.map((note) => (
        <p key={note}>{note}</p>
      ))}
      {terms ? <p className="pre">{terms}</p> : null}
    </div>
  );
}

function LeadBlock({ view, payLabel }: { view: DocumentView; payLabel: string }) {
  const lead = leadBlock(view, payLabel);
  return lead ? (
    <>
      <p className="label">{lead.label}</p>
      <p className="muted pre">{lead.text}</p>
    </>
  ) : null;
}

function PayAndNotes({ view, payLabel = "How to pay" }: { view: DocumentView; payLabel?: string }) {
  const lead = leadBlock(view, payLabel);
  return (
    <>
      <div>
        {lead ? (
          <>
            <p className="label">{lead.label}</p>
            <p className="muted pre">{lead.text}</p>
          </>
        ) : null}
      </div>
      <div>
        {view.notes ? (
          <>
            <p className="label">Notes</p>
            <p className="muted pre">{view.notes}</p>
          </>
        ) : null}
      </div>
    </>
  );
}

function Modern({ view }: TemplateProps) {
  const { issuer, billTo } = view;
  return (
    <>
      <header className="head">
        <div>
          <Logo party={issuer} />
          <p className="issuer-name">{issuer.name}</p>
          <Lines lines={[issuer.email ?? "", issuer.address ?? "", issuer.taxId ? `VAT ${issuer.taxId}` : ""]} />
        </div>
        <div>
          <p className="title">{view.labels.title}</p>
          <p className="title-number mono">{view.number}</p>
        </div>
      </header>
      <section className="due-block avoid">
        <div>
          <p className="label">{view.labels.amount}</p>
          <p className="due-amount">{view.totals.amountDue}</p>
        </div>
        <div className="due-date">
          <p className="label">{view.labels.endDate}</p>
          <strong>{view.end}</strong>
          <span className="muted">
            {view.termsLabel} · issued {view.issued}
          </span>
        </div>
      </section>
      <section className="parties avoid">
        <div>
          <p className="label">{view.labels.billTo}</p>
          {billTo ? (
            <>
              <p className="party-name">{billTo.name}</p>
              <Lines lines={partyLines(billTo)} />
            </>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
        {billTo?.taxId ? (
          <div>
            <p className="label">Tax ID</p>
            <p className="mono">{billTo.taxId}</p>
          </div>
        ) : null}
      </section>
      <LineTable view={view} />
      <Totals view={view} />
      <Footnotes view={view} />
      <div className="spacer" />
      <footer className="foot avoid">
        <PayAndNotes view={view} />
      </footer>
    </>
  );
}

function Classic({ view }: TemplateProps) {
  const { issuer, billTo } = view;
  const issuerLine = [issuer.address, issuer.email, issuer.taxId ? `VAT ${issuer.taxId}` : null].filter(Boolean).join(" · ");
  return (
    <>
      <header className="masthead">
        <p className="issuer-name">{issuer.name}</p>
        {issuerLine ? <p className="issuer-line">{issuerLine}</p> : null}
      </header>
      <p className="title">{view.labels.title}</p>
      <section className="parties avoid">
        <div>
          <p className="label">{view.kind === "estimate" ? view.labels.billTo : "To"}</p>
          {billTo ? (
            <>
              <p className="party-name">{billTo.name}</p>
              <Lines lines={partyLines(billTo, { tax: true })} />
            </>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
        <dl className="meta">
          <div>
            <dt>{view.labels.numberLabel}</dt>
            <dd className="mono">{view.number}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{view.issued}</dd>
          </div>
          <div>
            <dt>{view.labels.end}</dt>
            <dd>{view.end}</dd>
          </div>
          <div>
            <dt>Terms</dt>
            <dd>{view.termsLabel}</dd>
          </div>
        </dl>
      </section>
      <LineTable view={view} />
      <Totals view={view} />
      <Footnotes view={view} />
      <div className="spacer" />
      <footer className="avoid">
        <LeadBlock view={view} payLabel="Payment" />
        {view.notes ? <p className="muted pre" style={{ marginTop: 10 }}>{view.notes}</p> : null}
        <p className="thanks">Thank you for your business.</p>
      </footer>
    </>
  );
}

function Minimal({ view }: TemplateProps) {
  const { issuer, billTo } = view;
  return (
    <>
      <header className="head">
        <p className="issuer-name">{issuer.name}</p>
        <p className="mono muted">{view.number}</p>
      </header>
      <section className="due avoid">
        <p className="label">{view.labels.amount}</p>
        <p className="due-amount">{view.totals.amountDue}</p>
        <p className="muted">
          {view.labels.endPrefix} {view.end} · {view.termsLabel}
        </p>
      </section>
      <section className="parties avoid">
        <div>
          <p className="label">From</p>
          <p>{issuer.name}</p>
          <Lines lines={[issuer.email ?? "", issuer.taxId ? `VAT ${issuer.taxId}` : ""]} />
        </div>
        <div>
          <p className="label">To</p>
          {billTo ? (
            <>
              <p>{billTo.name}</p>
              <Lines lines={partyLines(billTo)} />
            </>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
        <div>
          <p className="label">Issued</p>
          <p>{view.issued}</p>
        </div>
      </section>
      <table className="lines">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((line, position) => (
            <tr key={position}>
              <td>
                <Description line={line} />
              </td>
              <td className="num">{line.quantity}</td>
              <td className="num">{line.rate ?? "—"}</td>
              <td className="num">{line.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Totals view={view} grandLabel="Total" />
      <Footnotes view={view} />
      <div className="spacer" />
      <footer className="avoid">
        <LeadBlock view={view} payLabel="Payment" />
        {view.notes ? <p className="muted pre" style={{ marginTop: 10 }}>{view.notes}</p> : null}
      </footer>
    </>
  );
}

function Professional({ view }: TemplateProps) {
  const { issuer, billTo } = view;
  const registration = [issuer.name, issuer.email, issuer.taxId ? `VAT ${issuer.taxId}` : null].filter(Boolean).join(" · ");
  return (
    <>
      <header className="band">
        <div className="band-issuer">
          <Logo party={issuer} />
          <div>
            <p className="issuer-name">{issuer.name}</p>
            <Lines lines={[issuer.address ?? "", [issuer.email, issuer.taxId ? `VAT ${issuer.taxId}` : null].filter(Boolean).join(" · ")]} />
          </div>
        </div>
        <div>
          <p className="title">{view.labels.title.toUpperCase()}</p>
          <p className="mono muted" style={{ textAlign: "right" }}>
            {view.number}
          </p>
        </div>
      </header>
      <section className="facts avoid">
        <div>
          <p className="label">{view.labels.billTo}</p>
          {billTo ? (
            <>
              <p className="strong">{billTo.name}</p>
              <Lines lines={partyLines(billTo)} />
            </>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
        <div>
          <p className="label">Dates</p>
          <p className="nowrap">Issued {view.issued}</p>
          <p className="nowrap">
            {view.labels.end} <span className="strong">{view.end}</span>
          </p>
          <p>{view.kind === "estimate" ? view.termsLabel : `Terms ${view.termsLabel}`}</p>
        </div>
        <div>
          <p className="label">{view.labels.amount}</p>
          <p className="facts-amount">{view.totals.amountDue}</p>
          <p className="muted">
            {view.currency}
            {billTo?.taxId ? ` · tax ID ${billTo.taxId}` : ""}
          </p>
        </div>
      </section>
      <div className="sheet">
        <LineTable view={view} index />
        <Totals view={view} />
      </div>
      <Footnotes view={view} />
      {leadBlock(view, "Payment details") || view.notes ? (
        <section className="boxes avoid">
          <div>
            <p className="label">{leadBlock(view, "Payment details")?.label ?? "Payment details"}</p>
            <p className="muted pre">{leadBlock(view, "Payment details")?.text ?? "—"}</p>
          </div>
          <div>
            <p className="label">Notes</p>
            <p className="muted pre">{view.notes ?? "—"}</p>
          </div>
        </section>
      ) : null}
      <div className="spacer" />
      <p className="registration">{registration}</p>
    </>
  );
}

function Bold({ view }: TemplateProps) {
  const { issuer, billTo } = view;
  return (
    <>
      <header className="masthead">
        <div className="masthead-top">
          <div className="brand">
            <Logo party={issuer} />
            {issuer.name}
          </div>
          <p className="title">{view.labels.title.toUpperCase()}</p>
        </div>
        <div className="masthead-facts">
          <div>
            <p className="label">{view.labels.amount}</p>
            <p className="due-amount">{view.totals.amountDue}</p>
          </div>
          <div>
            <p className="label">{view.labels.end}</p>
            <strong>{view.end}</strong>
          </div>
          <div className="right">
            <p className="label">Number</p>
            <strong className="mono">{view.number}</strong>
          </div>
        </div>
      </header>
      <section className="parties avoid">
        <div>
          <p className="label">{view.labels.billTo}</p>
          {billTo ? (
            <>
              <p className="party-name">{billTo.name}</p>
              <Lines lines={partyLines(billTo)} />
            </>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
        <div>
          <p className="label">From</p>
          <p className="party-name">{issuer.name}</p>
          <Lines lines={[issuer.address ?? "", issuer.taxId ? `VAT ${issuer.taxId}` : ""]} />
        </div>
      </section>
      <LineTable view={view} />
      <Totals view={view} />
      <Footnotes view={view} />
      <div className="spacer" />
      <footer className="foot avoid">
        <PayAndNotes view={view} />
      </footer>
    </>
  );
}

const TEMPLATES: Record<DocumentTemplate, (props: TemplateProps) => ReactNode> = {
  MODERN: Modern,
  CLASSIC: Classic,
  MINIMAL: Minimal,
  PROFESSIONAL: Professional,
  BOLD: Bold,
};

export function PrintedDocument({ view, template }: { view: DocumentView; template: DocumentTemplate }) {
  const Template = TEMPLATES[template];
  return (
    <article
      className={`doc doc-${template.toLowerCase()}`}
      style={{ "--doc-accent": view.accent } as CSSProperties}
      aria-label={`${view.labels.title} ${view.number}`}
    >
      <Template view={view} />
    </article>
  );
}
