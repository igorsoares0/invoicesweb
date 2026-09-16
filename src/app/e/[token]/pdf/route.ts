import { ApiError } from "@/server/api/errors";
import { errorResponse } from "@/server/api/responses";
import { clientIp, publicDocumentLimiter } from "@/server/auth/rate-limit";
import { pdfResponse } from "@/server/documents/render";
import { publicEstimateService } from "@/server/services/public-estimate-service";

export async function GET(request: Request, { params }: RouteContext<"/e/[token]/pdf">) {
  const limit = publicDocumentLimiter.consume(`pdf:${clientIp(request.headers)}`);
  if (!limit.allowed) return errorResponse(ApiError.rateLimited(limit.retryAfterSeconds));

  const { token } = await params;
  const result = await publicEstimateService.pdf(token);
  if (!result) return errorResponse(ApiError.notFound("Document"));
  return pdfResponse(result.pdf, result.number, "attachment");
}
