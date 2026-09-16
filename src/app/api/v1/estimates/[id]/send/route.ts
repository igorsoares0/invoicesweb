import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params }) =>
  ok(await estimateService.send(auth, params.id)),
);
