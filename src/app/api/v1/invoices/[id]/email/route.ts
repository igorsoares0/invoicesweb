import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { resolveBaseUrl } from "@/server/email/base-url";
import { emailService } from "@/server/services/email-service";

/**
 * Emails the invoice, sending it first if it is still a draft. Responds 200 even when the
 * provider refuses: the invoice is sent by then, so `data.email.status` carries the outcome.
 */
export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params, request, json }) =>
  ok(await emailService.sendDocument(auth, "invoice", params.id, await json(), resolveBaseUrl(request))),
);
