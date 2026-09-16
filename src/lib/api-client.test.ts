import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "./api-client";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    status === 204 ? new Response(null, { status }) : Response.json(body, { status }),
  ) as unknown as typeof fetch;
}

describe("api client", () => {
  it("unwraps the data envelope and sends JSON", async () => {
    const fetchImpl = mockFetch(201, { data: { id: "c1", name: "Pine & Co." } });
    const client = createApiClient(fetchImpl);

    await expect(client.post("/clients", { name: "Pine & Co." })).resolves.toEqual({ id: "c1", name: "Pine & Co." });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Pine & Co." }),
      credentials: "same-origin",
    });
  });

  it("sends extra headers such as an idempotency key", async () => {
    const fetchImpl = mockFetch(201, { data: {} });
    await createApiClient(fetchImpl).post("/invoices/i1/payments", { amount: "1" }, { headers: { "idempotency-key": "k-12345678" } });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/invoices/i1/payments",
      expect.objectContaining({ headers: { "content-type": "application/json", "idempotency-key": "k-12345678" } }),
    );
  });

  it("keeps pagination for lists", async () => {
    const client = createApiClient(mockFetch(200, { data: [], pagination: { page: 1, limit: 20, total: 0 } }));
    await expect(client.list("/clients")).resolves.toEqual({ data: [], pagination: { page: 1, limit: 20, total: 0 } });
  });

  it("resolves empty 204 responses", async () => {
    await expect(createApiClient(mockFetch(204, null)).delete("/clients/c1")).resolves.toBeUndefined();
  });

  it("throws ApiClientError with the code and field details", async () => {
    const client = createApiClient(
      mockFetch(422, {
        error: { code: "VALIDATION_ERROR", message: "Invalid", details: { email: ["Enter a valid email address"] } },
      }),
    );

    const error = await client.post("/clients", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 422, code: "VALIDATION_ERROR", message: "Invalid" });
    expect((error as ApiClientError).fieldError("email")).toBe("Enter a valid email address");
    expect((error as ApiClientError).fieldError("name")).toBeUndefined();
  });

  it("reports network failures and non-JSON errors", async () => {
    const offline = createApiClient(vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as never);
    await expect(offline.get("/me")).rejects.toMatchObject({ code: "NETWORK_ERROR" });

    const htmlError = createApiClient(vi.fn(async () => new Response("<html>", { status: 502 })) as never);
    await expect(htmlError.get("/me")).rejects.toMatchObject({ status: 502, code: "INTERNAL_ERROR" });
  });
});
