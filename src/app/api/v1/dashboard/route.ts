import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { dashboardService } from "@/server/services/dashboard-service";

export const GET = withApi({ auth: "business" }, async ({ auth, query }) =>
  ok(await dashboardService.get(auth, query.currency)),
);
