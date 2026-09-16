import { ApiError } from "@/server/api/errors";
import { withApi } from "@/server/api/handler";
import { created, ok } from "@/server/api/responses";
import { businessService } from "@/server/services/business-service";

export const GET = withApi({ auth: "user" }, async ({ auth }) => {
  const business = await businessService.getForUser(auth.userId);
  if (!business) throw ApiError.notFound("Business");
  return ok(business);
});

export const POST = withApi({ auth: "user" }, async ({ auth, json }) =>
  created(await businessService.create(auth.userId, await json())),
);

export const PATCH = withApi({ auth: "business" }, async ({ auth, json }) =>
  ok(await businessService.update(auth, await json())),
);
