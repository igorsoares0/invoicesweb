import { withApi } from "@/server/api/handler";
import { created } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params }) =>
  created(await estimateService.duplicate(auth, params.id)),
);
