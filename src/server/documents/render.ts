import "server-only";
import { createElement } from "react";
import type { Business, Client } from "@/generated/prisma/client";
import type { EstimateDto, InvoiceDto } from "@/lib/api-types";
import { buildDocumentView, type DocumentView, type PartyInput } from "@/lib/documents/view";
import { DOCUMENT_CSS } from "@/features/documents/document-styles";
import { PrintedDocument } from "@/features/documents/document-templates";
import { db } from "@/server/db";
import { embeddedFontCss } from "@/server/pdf/fonts";
import { renderPdf } from "@/server/pdf/pdf-renderer";
import { billingService } from "@/server/services/billing-service";
import { billToSnapshot, issuerSnapshot, type BillToSnapshot, type IssuerSnapshot } from "./snapshots";

export interface DocumentParties {
  issuer: PartyInput;
  billTo: PartyInput | null;
  /** Whether it prints "Made with Invoice Maker". */
  branded: boolean;
}

/**
 * Who the document is from and to, and whether it carries the "Made with" mark. Sent documents
 * print the snapshot taken when they were sent; drafts show the business and client as they are
 * now. The mark follows the plan at send time, except that an owner who is on Pro today never
 * shows it — upgrading cleans up links already sent, downgrading never brands them after the fact.
 */
export async function documentParties(invoice: {
  status: string;
  issuerSnapshot: unknown;
  billToSnapshot: unknown;
  clientId: string | null;
  businessId: string;
}): Promise<DocumentParties> {
  const business = (await db.business.findUniqueOrThrow({ where: { id: invoice.businessId } })) as Business;
  const plan = await billingService.planFor(business.userId);
  const onPro = plan.plan === "PRO";

  if (invoice.status !== "DRAFT" && invoice.issuerSnapshot) {
    const snapshot = invoice.issuerSnapshot as unknown as IssuerSnapshot;
    return {
      issuer: snapshot,
      billTo: (invoice.billToSnapshot as unknown as BillToSnapshot | null) ?? null,
      branded: Boolean(snapshot.branded) && !onPro,
    };
  }
  const client = invoice.clientId
    ? ((await db.client.findUnique({ where: { id: invoice.clientId } })) as Client | null)
    : null;
  return { issuer: issuerSnapshot(business), billTo: client ? billToSnapshot(client) : null, branded: !onPro };
}

export function invoiceViewFrom(dto: InvoiceDto, parties: DocumentParties): DocumentView {
  return buildDocumentView({
    number: dto.number,
    currency: dto.currency,
    issueDate: dto.issueDate,
    endDate: dto.dueDate,
    issuer: parties.issuer,
    billTo: parties.billTo,
    lines: dto.items,
    subtotal: dto.subtotal,
    discount: dto.discount,
    tax: dto.tax,
    total: dto.total,
    amountPaid: dto.amountPaid,
    amountDue: dto.status === "DRAFT" ? dto.total : dto.amountDue,
    notes: dto.notes,
    terms: dto.terms,
    color: dto.color,
    branded: parties.branded,
  });
}

export function estimateViewFrom(dto: EstimateDto, parties: DocumentParties): DocumentView {
  return buildDocumentView({
    kind: "estimate",
    number: dto.number,
    currency: dto.currency,
    issueDate: dto.issueDate,
    endDate: dto.expiryDate,
    issuer: parties.issuer,
    billTo: parties.billTo,
    lines: dto.items,
    subtotal: dto.subtotal,
    discount: dto.discount,
    tax: dto.tax,
    total: dto.total,
    amountPaid: "0.00",
    amountDue: dto.total,
    notes: dto.notes,
    terms: dto.terms,
    color: dto.color,
    branded: parties.branded,
  });
}

export async function renderDocumentHtml(view: DocumentView, template: InvoiceDto["template"]): Promise<string> {
  // Imported lazily: Next.js only allows react-dom/server outside of component modules.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(PrintedDocument, { view, template }));
  const fonts = await embeddedFontCss();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${view.number}</title><style>
${fonts}
@page { size: A4; margin: 28px 0; }
@page :first { margin-top: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
${DOCUMENT_CSS}
/* Fill the first page exactly, so footers sit at the bottom without spilling onto a blank page. */
.doc { min-height: calc(100vh - 32px); }
</style></head><body>${markup}</body></html>`;
}

export async function renderDocumentPdf(view: DocumentView, template: InvoiceDto["template"]): Promise<Buffer> {
  return renderPdf(await renderDocumentHtml(view, template));
}

export function pdfResponse(pdf: Buffer, number: string, disposition: "inline" | "attachment"): Response {
  const filename = `${number.replace(/[^\w.-]+/g, "_")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
