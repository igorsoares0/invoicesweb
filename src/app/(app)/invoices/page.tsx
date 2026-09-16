import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SearchInput } from "@/components/list/search-input";
import { InvoicesTable } from "@/features/invoices/invoices-table";
import { NewDocumentButton } from "@/features/documents/new-document-button";
import { firstValues } from "@/lib/url";
import { listInvoicesQuerySchema } from "@/lib/validation/invoice";
import { requireBusiness } from "@/server/auth/session";
import { invoiceService } from "@/server/services/invoice-service";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const { user, business } = await requireBusiness();
  const params = firstValues(await searchParams);
  const parsed = listInvoicesQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : listInvoicesQuerySchema.parse({});
  const result = await invoiceService.list({ userId: user.id, businessId: business.id }, query);

  return (
    <>
      <PageHeader title="Invoices" actions={<NewDocumentButton />} />
      <main className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        <SearchInput label="Search invoices" placeholder="Search number, client or item" />
        <InvoicesTable
          result={result}
          pathname="/invoices"
          searchParams={params}
          filter={query.status}
          emptyAction={<NewDocumentButton label="Create your first invoice" />}
        />
      </main>
    </>
  );
}
