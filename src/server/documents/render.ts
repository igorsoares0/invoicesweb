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
import { billToSnapshot, issuerSnapshot, type BillToSnapshot, type IssuerSnapshot } from "./snapshots";

/**
 * Who the document is from and to. Sent invoices print the snapshot taken when they were sent;
 * drafts show the business and client as they are now.
 */
export async function documentParties(invoice: {
  status: string;
  issuerSnapshot: unknown;
  billToSnapshot: unknown;
  clientId: string | null;
  businessId: string;
}): Promise<{ issuer: PartyInput; billTo: PartyInput | null }> {
  if (invoice.status !== "DRAFT" && invoice.issuerSnapshot) {
    return {
      issuer: invoice.issuerSnapshot as unknown as IssuerSnapshot,
      billTo: (invoice.billToSnapshot as unknown as BillToSnapshot | null) ?? null,
    };
  }
  const [business, client] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: invoice.businessId } }) as Promise<Business>,
    invoice.clientId ? (db.client.findUnique({ where: { id: invoice.clientId } }) as Promise<Client | null>) : null,
  ]);
  return { issuer: issuerSnapshot(business), billTo: client ? billToSnapshot(client) : null };
}

export function invoiceViewFrom(dto: InvoiceDto, parties: { issuer: PartyInput; billTo: PartyInput | null }): DocumentView {
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
  });
}

export function estimateViewFrom(dto: EstimateDto, parties: { issuer: PartyInput; billTo: PartyInput | null }): DocumentView {
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
