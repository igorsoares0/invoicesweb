import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/features/documents/editor/document-editor";
import { toEditable } from "@/features/documents/editor/kinds";
import { EstimateDetail } from "@/features/estimates/estimate-detail";
import { todayIn } from "@/lib/dates";
import { formatDocumentNumber } from "@/lib/numbering";
import { firstValues } from "@/lib/url";
import { ApiError } from "@/server/api/errors";
import { requireBusiness } from "@/server/auth/session";
import { isEmailEnabled } from "@/server/email/transport";
import { documentParties, estimateViewFrom } from "@/server/documents/render";
import { estimateRepository } from "@/server/repositories/estimate-repository";
import { clientService } from "@/server/services/client-service";
import { estimateService } from "@/server/services/estimate-service";
import { productService } from "@/server/services/product-service";

export const metadata: Metadata = { title: "Estimate" };

export default async function EstimatePage({ params, searchParams }: PageProps<"/estimates/[id]">) {
  const { id } = await params;
  const query = firstValues(await searchParams);
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };

  const estimate = await estimateService.get(context, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === "RESOURCE_NOT_FOUND") notFound();
    throw error;
  });

  if (estimate.status === "DRAFT") {
    const [clients, products] = await Promise.all([
      clientService.list(context, { limit: 100, sort: "name" }),
      productService.list(context, { limit: 100, sort: "name" }),
    ]);
    return (
      <DocumentEditor
        key={estimate.id}
        kind="estimate"
        initial={toEditable(estimate)}
        issuer={business}
        clients={clients.data}
        products={products.data}
        defaultTaxRate={business.defaultTaxRate}
        emailEnabled={isEmailEnabled()}
      />
    );
  }

  const detail = await estimateRepository.findDetail(business.id, id);
  const view = estimateViewFrom(estimate, await documentParties(detail!));
  return (
    <EstimateDetail
      key={estimate.updatedAt}
      estimate={estimate}
      view={view}
      timezone={business.timezone}
      today={todayIn(business.timezone)}
      nextInvoiceNumber={formatDocumentNumber(business.invoicePrefix, business.invoiceNextNumber)}
      paymentTermsDays={business.paymentTermsDays}
      openConvert={query.convert === "1"}
      businessName={business.name}
      emailEnabled={isEmailEnabled()}
    />
  );
}
