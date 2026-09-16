import { withApi } from "@/server/api/handler";
import { created, list } from "@/server/api/responses";
import { invoiceService } from "@/server/services/invoice-service";

export const GET = withApi({ auth: "business" }, async ({ auth, query }) => {
  const result = await invoiceService.list(auth, query);
  return list(result.data, result.pagination);
});

export const POST = withApi({ auth: "business" }, async ({ auth, optionalJson }) =>
  created(await invoiceService.create(auth, await optionalJson())),
);
