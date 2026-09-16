import "server-only";
import { ApiError } from "@/server/api/errors";
import { errorResponse, ok } from "@/server/api/responses";
import { clientIp, publicDocumentLimiter } from "@/server/auth/rate-limit";
import { publicEstimateService } from "@/server/services/public-estimate-service";

/** Shared by the public accept and decline endpoints. */
export async function publicEstimateReply(request: Request, token: string, answer: "accept" | "decline") {
  const limit = publicDocumentLimiter.consume(`reply:${clientIp(request.headers)}`);
  if (!limit.allowed) return errorResponse(ApiError.rateLimited(limit.retryAfterSeconds));
  try {
    const estimate = await publicEstimateService.respond(token, answer);
    return ok({ state: estimate.state, stateLabel: estimate.stateLabel });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error("Public estimate reply failed", { error });
    return errorResponse(new ApiError("INTERNAL_ERROR", "Something went wrong"));
  }
}
