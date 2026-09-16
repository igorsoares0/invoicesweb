import "server-only";
import { getBusinessContext, getUserContext, hasBusiness } from "@/server/auth/context";
import type { BusinessContext, UserContext } from "@/server/auth/types";
import { ApiError } from "./errors";
import { errorResponse } from "./responses";

type AuthMode = "public" | "user" | "business";

type AuthFor<TMode extends AuthMode> = TMode extends "business"
  ? BusinessContext
  : TMode extends "user"
    ? UserContext
    : null;

export interface HandlerContext<TMode extends AuthMode, TParams> {
  request: Request;
  auth: AuthFor<TMode>;
  params: TParams;
  /** Parses the JSON body; services validate its shape. */
  json(): Promise<unknown>;
  /** Query string as a plain object; services validate its shape. */
  query: Record<string, string>;
}

async function resolveAuth(mode: AuthMode): Promise<UserContext | BusinessContext | null> {
  if (mode === "public") return null;
  if (mode === "user") {
    const user = await getUserContext();
    if (!user) throw ApiError.unauthorized();
    return user;
  }
  const context = await getBusinessContext();
  if (!context) throw ApiError.unauthorized();
  if (!hasBusiness(context)) throw ApiError.forbidden("Create your business profile first");
  return context;
}

/**
 * Wraps a route handler: resolves authentication, exposes the body and query, and turns any
 * thrown error into the `{ error: { code, message } }` envelope (spec §60).
 */
export function withApi<TMode extends AuthMode, TParams = Record<string, never>>(
  options: { auth: TMode },
  handler: (context: HandlerContext<TMode, TParams>) => Promise<Response>,
) {
  return async (request: Request, routeContext: { params: Promise<TParams> }): Promise<Response> => {
    try {
      const auth = (await resolveAuth(options.auth)) as AuthFor<TMode>;
      const params = await routeContext.params;
      return await handler({
        request,
        auth,
        params,
        query: Object.fromEntries(new URL(request.url).searchParams),
        async json() {
          try {
            return await request.json();
          } catch {
            throw ApiError.validation({ _form: ["Request body must be valid JSON"] });
          }
        },
      });
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error("Unhandled API error", { url: request.url, method: request.method, error });
      return errorResponse(new ApiError("INTERNAL_ERROR", "Something went wrong"));
    }
  };
}
