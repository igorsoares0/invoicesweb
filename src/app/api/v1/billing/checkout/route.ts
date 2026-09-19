import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { resolveBaseUrl } from "@/server/email/base-url";
import { billingService } from "@/server/services/billing-service";

/** `{ interval: "MONTH" | "YEAR" }` → a Paddle transaction id for the overlay checkout. */
export const POST = withApi({ auth: "business" }, async ({ auth, request, json }) =>
  ok(await billingService.checkout(auth, await json(), resolveBaseUrl(request))),
);
