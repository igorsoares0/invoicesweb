import { withApi } from "@/server/api/handler";
import { noContent, ok } from "@/server/api/responses";
import { invoiceService } from "@/server/services/invoice-service";

type Params = { id: string };

export const GET = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await invoiceService.get(auth, params.id)),
);

export const PATCH = withApi<"business", Params>({ auth: "business" }, async ({ auth, params, json }) =>
  ok(await invoiceService.update(auth, params.id, await json())),
);

export const DELETE = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) => {
  await invoiceService.remove(auth, params.id);
  return noContent();
});
