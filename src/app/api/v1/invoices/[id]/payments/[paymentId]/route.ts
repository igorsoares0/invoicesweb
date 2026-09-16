import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { paymentService } from "@/server/services/payment-service";

export const DELETE = withApi<"business", { id: string; paymentId: string }>(
  { auth: "business" },
  async ({ auth, params }) => ok(await paymentService.remove(auth, params.id, params.paymentId)),
);
