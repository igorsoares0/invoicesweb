import { withApi } from "@/server/api/handler";
import { noContent, ok } from "@/server/api/responses";
import { clientService } from "@/server/services/client-service";

type Params = { id: string };

export const GET = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await clientService.get(auth, params.id)),
);

export const PATCH = withApi<"business", Params>({ auth: "business" }, async ({ auth, params, json }) =>
  ok(await clientService.update(auth, params.id, await json())),
);

export const DELETE = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) => {
  await clientService.remove(auth, params.id);
  return noContent();
});
