import { withApi } from "@/server/api/handler";
import { created, list } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

export const GET = withApi({ auth: "business" }, async ({ auth, query }) => {
  const result = await estimateService.list(auth, query);
  return list(result.data, result.pagination);
});

export const POST = withApi({ auth: "business" }, async ({ auth, optionalJson }) =>
  created(await estimateService.create(auth, await optionalJson())),
);
