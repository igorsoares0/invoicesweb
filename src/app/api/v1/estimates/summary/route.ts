import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { estimateService } from "@/server/services/estimate-service";

export const GET = withApi({ auth: "business" }, async ({ auth, query }) => ok(await estimateService.summary(auth, query.currency)));
