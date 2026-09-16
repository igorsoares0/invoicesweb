import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { DashboardStats } from "@/features/invoices/dashboard-stats";
import { InvoicesTable } from "@/features/invoices/invoices-table";
import { NewInvoiceButton } from "@/features/invoices/new-invoice-button";
import { firstValues } from "@/lib/url";
import { listInvoicesQuerySchema } from "@/lib/validation/invoice";
import { requireBusiness } from "@/server/auth/session";
import { dashboardService } from "@/server/services/dashboard-service";
import { invoiceService } from "@/server/services/invoice-service";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: PageProps<"/overview">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const params = firstValues(await searchParams);
  const parsed = listInvoicesQuerySchema.safeParse({ status: params.status, limit: 8 });
  const query = parsed.success ? parsed.data : listInvoicesQuerySchema.parse({ limit: 8 });

  const [stats, invoices] = await Promise.all([
    dashboardService.get(context, params.currency),
    invoiceService.list(context, query),
  ]);

  return (
    <>
      <PageHeader title="Overview" actions={<NewInvoiceButton />} />
      <main className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        <DashboardStats stats={stats} paymentTermsDays={business.paymentTermsDays} />
        <InvoicesTable
          result={invoices}
          pathname="/overview"
          searchParams={params}
          filter={query.status}
          title="Recent invoices"
          emptyAction={<NewInvoiceButton label="Create your first invoice" />}
          paginate={false}
        />
      </main>
    </>
  );
}
