import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { billingService } from "@/server/services/billing-service";

/** Signed-in links to Paddle's customer portal. Created on demand: they expire. */
export const POST = withApi({ auth: "business" }, async ({ auth }) => ok(await billingService.portal(auth)));
