import "server-only";
import { createElement } from "react";
import type { Business, Client } from "@/generated/prisma/client";
import type { InvoiceDto } from "@/lib/api-types";
import { buildInvoiceView, type InvoiceView, type PartyInput } from "@/lib/documents/view";
import { DOCUMENT_CSS } from "@/features/documents/document-styles";
import { InvoiceDocument } from "@/features/documents/invoice-document";
import { db } from "@/server/db";
import { embeddedFontCss } from "@/server/pdf/fonts";
import { renderPdf } from "@/server/pdf/pdf-renderer";
import type { InvoiceDetail } from "@/server/repositories/invoice-repository";
import { billToSnapshot, issuerSnapshot, type BillToSnapshot, type IssuerSnapshot } from "./snapshots";

/**
 * Who the document is from and to. Sent invoices print the snapshot taken when they were sent;
 * drafts show the business and client as they are now.
 */
export async function documentParties(
  invoice: Pick<InvoiceDetail, "status" | "issuerSnapshot" | "billToSnapshot" | "clientId" | "businessId">,
): Promise<{ issuer: PartyInput; billTo: PartyInput | null }> {
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

export function invoiceViewFrom(dto: InvoiceDto, parties: { issuer: PartyInput; billTo: PartyInput | null }): InvoiceView {
  return buildInvoiceView({
    number: dto.number,
    currency: dto.currency,
    issueDate: dto.issueDate,
    dueDate: dto.dueDate,
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

export async function renderInvoiceHtml(view: InvoiceView, template: InvoiceDto["template"]): Promise<string> {
  // Imported lazily: Next.js only allows react-dom/server outside of component modules.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(InvoiceDocument, { view, template }));
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

export async function renderInvoicePdf(view: InvoiceView, template: InvoiceDto["template"]): Promise<Buffer> {
  return renderPdf(await renderInvoiceHtml(view, template));
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
