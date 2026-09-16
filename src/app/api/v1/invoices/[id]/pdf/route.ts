import { withApi } from "@/server/api/handler";
import { pdfResponse } from "@/server/invoices/document";
import { invoiceService } from "@/server/services/invoice-service";

type Params = { id: string };

const handler = withApi<"business", Params>({ auth: "business" }, async ({ auth, params, query }) => {
  const { pdf, number } = await invoiceService.pdf(auth, params.id);
  return pdfResponse(pdf, number, query.download === "1" ? "attachment" : "inline");
});

// GET for links and <a download>; POST as listed in the spec (§27).
export const GET = handler;
export const POST = handler;
