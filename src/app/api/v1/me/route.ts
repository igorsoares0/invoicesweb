import { withApi } from "@/server/api/handler";
import { ok } from "@/server/api/responses";
import { businessService } from "@/server/services/business-service";

export const GET = withApi({ auth: "user" }, async ({ auth }) => ok(await businessService.getMe(auth.userId)));
