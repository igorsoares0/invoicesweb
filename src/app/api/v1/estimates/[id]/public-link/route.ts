import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

type Params = { id: string };

export const POST = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await estimateService.createLink(auth, params.id)),
);

export const DELETE = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await estimateService.revokeLink(auth, params.id)),
);
