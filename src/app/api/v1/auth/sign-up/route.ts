import { ApiError } from "@/server/api/errors";
import { withApi } from "@/server/api/handler";
import { created } from "@/server/api/responses";
import { clientIp, signUpLimiter } from "@/server/auth/rate-limit";
import { userService } from "@/server/services/user-service";

export const POST = withApi({ auth: "public" }, async ({ request, json }) => {
  const limit = signUpLimiter.consume(clientIp(request.headers));
  if (!limit.allowed) throw ApiError.rateLimited(limit.retryAfterSeconds);
  return created(await userService.signUp(await json()));
});
