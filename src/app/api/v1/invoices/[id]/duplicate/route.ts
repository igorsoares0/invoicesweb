import { withApi } from "@/server/api/handler";
import { created } from "@/server/api/responses";
import { invoiceService } from "@/server/services/invoice-service";

export const POST = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params }) =>
  created(await invoiceService.duplicate(auth, params.id)),
);
