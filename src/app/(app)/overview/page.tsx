import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { DashboardStats } from "@/features/invoices/dashboard-stats";
import { ReadyToConvertStrip } from "@/features/estimates/ready-to-convert-strip";
import { InvoicesTable } from "@/features/invoices/invoices-table";
import { NewDocumentButton } from "@/features/documents/new-document-button";
import { firstValues } from "@/lib/url";
import { listInvoicesQuerySchema } from "@/lib/validation/invoice";
import { requireBusiness } from "@/server/auth/session";
import { dashboardService } from "@/server/services/dashboard-service";
import { estimateService } from "@/server/services/estimate-service";
import { invoiceService } from "@/server/services/invoice-service";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: PageProps<"/overview">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const params = firstValues(await searchParams);
  const parsed = listInvoicesQuerySchema.safeParse({ status: params.status, limit: 8 });
  const query = parsed.success ? parsed.data : listInvoicesQuerySchema.parse({ limit: 8 });

  const [stats, invoices, estimates] = await Promise.all([
    dashboardService.get(context, params.currency),
    invoiceService.list(context, query),
    estimateService.summary(context),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <>
            <NewDocumentButton kind="estimate" variant="outline" className="hidden sm:inline-flex" />
            <NewDocumentButton />
          </>
        }
      />
      <main className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        <DashboardStats stats={stats} paymentTermsDays={business.paymentTermsDays} />
        <InvoicesTable
          result={invoices}
          pathname="/overview"
          searchParams={params}
          filter={query.status}
          title="Recent invoices"
          emptyAction={<NewDocumentButton label="Create your first invoice" />}
          paginate={false}
          footer={estimates.readyToConvert ? <ReadyToConvertStrip ready={estimates.readyToConvert} /> : null}
        />
      </main>
    </>
  );
}
