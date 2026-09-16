import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { paymentService } from "@/server/services/payment-service";

export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params, optionalJson }) =>
  ok(await paymentService.markPaid(auth, params.id, await optionalJson())),
);
