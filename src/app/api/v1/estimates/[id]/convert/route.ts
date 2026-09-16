import { withApi } from "@/server/api/handler";
import { created } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

/** Creates a draft invoice from an accepted estimate. Returns `{ invoice, estimate }`. */
export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params, json }) =>
  created(await estimateService.convert(auth, params.id, await json())),
);
