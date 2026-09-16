import { withApi } from "@/server/api/handler";
import { created, list } from "@/server/api/responses";
import { productService } from "@/server/services/product-service";

export const GET = withApi({ auth: "business" }, async ({ auth, query }) => {
  const result = await productService.list(auth, query);
  return list(result.data, result.pagination);
});

export const POST = withApi({ auth: "business" }, async ({ auth, json }) =>
  created(await productService.create(auth, await json())),
);
