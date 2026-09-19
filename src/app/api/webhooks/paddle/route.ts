import { ApiError } from "@/server/api/errors";
import { errorResponse, ok } from "@/server/api/responses";
import { billingService } from "@/server/services/billing-service";

/**
 * Paddle notifications (spec §51). Outside `withApi`: there is no session, and the signature is
 * computed over the raw body, so it must be read as text before anything parses it. Anything not
 * ours — another product in the shared sandbox, an unknown account — still answers 200, or Paddle
 * would retry it forever; a real failure answers 500 so it does retry.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    return ok(await billingService.handlePaddleWebhook(rawBody, request.headers.get("paddle-signature")));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error("Paddle webhook failed", { error });
    return errorResponse(new ApiError("INTERNAL_ERROR", "Something went wrong"));
  }
}
