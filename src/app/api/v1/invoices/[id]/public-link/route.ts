import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { invoiceService } from "@/server/services/invoice-service";

type Params = { id: string };

/** Creates a new public link (after a revoke). */
export const POST = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await invoiceService.createLink(auth, params.id)),
);

/** Revokes the public link; anyone holding it sees a dead-link page. */
export const DELETE = withApi<"business", Params>({ auth: "business" }, async ({ auth, params }) =>
  ok(await invoiceService.revokeLink(auth, params.id)),
);
