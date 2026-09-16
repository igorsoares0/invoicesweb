import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { invoiceService } from "@/server/services/invoice-service";

export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params }) =>
  ok(await invoiceService.send(auth, params.id)),
);
