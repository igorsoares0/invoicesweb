import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { billingService } from "@/server/services/billing-service";

/** The plan summary on its own, for refreshing the sidebar and the limit modal. */
export const GET = withApi({ auth: "business" }, async ({ auth }) => ok(await billingService.summary(auth)));
