import { withApi } from "@/server/api/handler";
import { created, list } from "@/server/api/responses";
import { clientService } from "@/server/services/client-service";

export const GET = withApi({ auth: "business" }, async ({ auth, query }) => {
  const result = await clientService.list(auth, query);
  return list(result.data, result.pagination);
});

export const POST = withApi({ auth: "business" }, async ({ auth, json }) =>
  created(await clientService.create(auth, await json())),
);
