import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { resolveBaseUrl } from "@/server/email/base-url";
import { emailService } from "@/server/services/email-service";

/** Emails the estimate, sending it first if it is still a draft. See the invoice route. */
export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params, request, json }) =>
  ok(await emailService.sendDocument(auth, "estimate", params.id, await json(), resolveBaseUrl(request))),
);
