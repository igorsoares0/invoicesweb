import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceDetail } from "@/features/invoices/detail/invoice-detail";
import { DocumentEditor } from "@/features/documents/editor/document-editor";
import { toEditable } from "@/features/documents/editor/kinds";
import { todayIn } from "@/lib/dates";
import { ApiError } from "@/server/api/errors";
import { requireBusiness } from "@/server/auth/session";
import { documentParties, invoiceViewFrom } from "@/server/documents/render";
import { invoiceRepository } from "@/server/repositories/invoice-repository";
import { clientService } from "@/server/services/client-service";
import { invoiceService } from "@/server/services/invoice-service";
import { productService } from "@/server/services/product-service";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };

  const invoice = await invoiceService.get(context, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === "RESOURCE_NOT_FOUND") notFound();
    throw error;
  });

  if (invoice.status === "DRAFT") {
    const [clients, products] = await Promise.all([
      clientService.list(context, { limit: 100, sort: "name" }),
      productService.list(context, { limit: 100, sort: "name" }),
    ]);
    return (
      <DocumentEditor
        key={invoice.id}
        kind="invoice"
        initial={toEditable(invoice)}
        issuer={business}
        clients={clients.data}
        products={products.data}
        defaultTaxRate={business.defaultTaxRate}
        origin={
          invoice.fromEstimate
            ? { href: `/estimates/${invoice.fromEstimate.id}`, label: `Converted from ${invoice.fromEstimate.number}` }
            : undefined
        }
      />
    );
  }

  const detail = await invoiceRepository.findDetail(business.id, id);
  const view = invoiceViewFrom(invoice, await documentParties(detail!));
  return (
    <InvoiceDetail
      // Remount with fresh server data after router.refresh().
      key={invoice.updatedAt}
      invoice={invoice}
      view={view}
      timezone={business.timezone}
      today={todayIn(business.timezone)}
    />
  );
}
