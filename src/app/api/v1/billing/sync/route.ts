import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { billingService } from "@/server/services/billing-service";

/** `{ transactionId }` after `checkout.completed`: stores the subscription without waiting for the webhook. */
export const POST = withApi({ auth: "business" }, async ({ auth, json }) => ok(await billingService.syncCheckout(auth, await json())));
