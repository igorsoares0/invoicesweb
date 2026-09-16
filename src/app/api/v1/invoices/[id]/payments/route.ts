import { withApi } from "@/server/api/handler";
import { created, list } from "@/server/api/responses";
import { invoiceService } from "@/server/services/invoice-service";
import { paymentService } from "@/server/services/payment-service";

type Params = { id: string };

export const GET = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) => {
  const { payments } = await invoiceService.get(auth, params.id);
  return list(payments, { page: 1, limit: payments.length, total: payments.length });
});

/** Send an `Idempotency-Key` header to make retries safe. Returns the updated invoice. */
export const POST = withApi<"business", Params>({ auth: "business" }, async ({ auth, params, request, json }) =>
  created(await paymentService.record(auth, params.id, await json(), request.headers.get("idempotency-key"))),
);
