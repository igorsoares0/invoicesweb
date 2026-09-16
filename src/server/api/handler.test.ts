import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { withApi } from "./handler";
import { ok } from "./responses";

const context = vi.hoisted(() => ({
  user: null as { userId: string } | null,
  businessId: null as string | null,
}));

vi.mock("@/server/auth/context", () => ({
  getUserContext: async () => context.user,
  getBusinessContext: async () => (context.user ? { ...context.user, businessId: context.businessId } : null),
  hasBusiness: (value: { businessId: string | null }) => value.businessId !== null,
}));

type Handler = (request: Request, context: { params: Promise<Record<string, never>> }) => Promise<Response>;

function call(handler: Handler, init?: RequestInit & { url?: string }) {
  return handler(new Request(init?.url ?? "http://localhost/api/v1/test", init), {
    params: Promise.resolve({}),
  });
}

beforeEach(() => {
  context.user = null;
  context.businessId = null;
});

describe("withApi", () => {
  it("returns 401 with the error envelope when a user is required", async () => {
    const response = await call(withApi({ auth: "user" }, async () => ok({})));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  });

  it("returns 403 when the route needs a business the user hasn't created", async () => {
    context.user = { userId: "u1" };
    const response = await call(withApi({ auth: "business" }, async () => ok({})));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("passes the business context, params and query to the handler", async () => {
    context.user = { userId: "u1" };
    context.businessId = "b1";
    const handler = withApi<"business", { id: string }>({ auth: "business" }, async ({ auth, params, query }) =>
      ok({ auth, params, query }),
    );
    const response = await handler(new Request("http://localhost/x?page=2&q=pine"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(await response.json()).toEqual({
      data: { auth: { userId: "u1", businessId: "b1" }, params: { id: "c1" }, query: { page: "2", q: "pine" } },
    });
  });

  it("maps invalid JSON bodies to a validation error", async () => {
    const handler = withApi({ auth: "public" }, async ({ json }) => ok(await json()));
    const response = await call(handler, { method: "POST", body: "{nope" });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid data",
        details: { _form: ["Request body must be valid JSON"] },
      },
    });
  });

  it("serializes ApiError details and headers", async () => {
    const handler = withApi({ auth: "public" }, async () => {
      throw ApiError.rateLimited(42);
    });
    const response = await call(handler);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
  });

  it("hides unexpected errors behind INTERNAL_ERROR", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApi({ auth: "public" }, async () => {
      throw new Error("database password is hunter2");
    });
    const response = await call(handler);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    expect(JSON.stringify(body)).not.toContain("hunter2");
    consoleError.mockRestore();
  });
});
