import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { billingService } from "@/server/services/billing-service";

/** `{ interval: "MONTH" | "YEAR" }` → a Paddle transaction id for the overlay checkout. */
export const POST = withApi({ auth: "business" }, async ({ auth, json }) => ok(await billingService.checkout(auth, await json())));
