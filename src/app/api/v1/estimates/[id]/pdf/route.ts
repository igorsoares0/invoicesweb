import { withApi } from "@/server/api/handler";
import { pdfResponse } from "@/server/documents/render";
import { estimateService } from "@/server/services/estimate-service";

const handler = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params, query }) => {
  const { pdf, number } = await estimateService.pdf(auth, params.id);
  return pdfResponse(pdf, number, query.download === "1" ? "attachment" : "inline");
});

export const GET = handler;
export const POST = handler;
