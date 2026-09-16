import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SearchInput } from "@/components/list/search-input";
import { NewDocumentButton } from "@/features/documents/new-document-button";
import { EstimateSummaryCards } from "@/features/estimates/estimate-summary-cards";
import { EstimatesTable } from "@/features/estimates/estimates-table";
import { ReadyToConvertStrip } from "@/features/estimates/ready-to-convert-strip";
import { firstValues } from "@/lib/url";
import { listEstimatesQuerySchema } from "@/lib/validation/estimate";
import { requireBusiness } from "@/server/auth/session";
import { estimateService } from "@/server/services/estimate-service";

export const metadata: Metadata = { title: "Estimates" };

export default async function EstimatesPage({ searchParams }: PageProps<"/estimates">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const params = firstValues(await searchParams);
  const parsed = listEstimatesQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : listEstimatesQuerySchema.parse({});

  const [result, summary] = await Promise.all([
    estimateService.list(context, query),
    estimateService.summary(context, params.currency),
  ]);

  return (
    <>
      <PageHeader title="Estimates" actions={<NewDocumentButton kind="estimate" />} />
      <main className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        <EstimateSummaryCards summary={summary} />
        <EstimatesTable
          result={result}
          searchParams={params}
          filter={query.status}
          search={<SearchInput label="Search estimates" placeholder="Search" />}
          emptyAction={<NewDocumentButton kind="estimate" label="Create your first estimate" />}
          footer={summary.readyToConvert ? <ReadyToConvertStrip ready={summary.readyToConvert} /> : null}
        />
      </main>
    </>
  );
}
