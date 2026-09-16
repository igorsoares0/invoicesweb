import { withApi } from "@/server/api/handler";
import { noContent, ok } from "@/server/api/responses";
import { productService } from "@/server/services/product-service";

type Params = { id: string };

export const GET = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await productService.get(auth, params.id)),
);

export const PATCH = withApi<"business", Params>({ auth: "business" }, async ({ auth, params, json }) =>
  ok(await productService.update(auth, params.id, await json())),
);

export const DELETE = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) => {
  await productService.remove(auth, params.id);
  return noContent();
});
