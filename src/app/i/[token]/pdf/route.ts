import { ApiError } from "@/server/api/errors";
import { errorResponse } from "@/server/api/responses";
import { clientIp, publicDocumentLimiter } from "@/server/auth/rate-limit";
import { pdfResponse } from "@/server/invoices/document";
import { publicInvoiceService } from "@/server/services/public-invoice-service";

export async function GET(request: Request, { params }: RouteContext<"/i/[token]/pdf">) {
  const limit = publicDocumentLimiter.consume(`pdf:${clientIp(request.headers)}`);
  if (!limit.allowed) return errorResponse(ApiError.rateLimited(limit.retryAfterSeconds));

  const { token } = await params;
  const result = await publicInvoiceService.pdf(token);
  // Same answer for unknown, revoked and cancelled links.
  if (!result) return errorResponse(ApiError.notFound("Document"));
  return pdfResponse(result.pdf, result.number, "attachment");
}
