import { withApi } from "@/server/api/handler";
import { noContent, ok } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

type Params = { id: string };

export const GET = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await estimateService.get(auth, params.id)),
);

export const PATCH = withApi<"business", Params>({ auth: "business" }, async ({ auth, params, json }) =>
  ok(await estimateService.update(auth, params.id, await json())),
);

export const DELETE = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) => {
  await estimateService.remove(auth, params.id);
  return noContent();
});
