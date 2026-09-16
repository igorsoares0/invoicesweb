import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { db } from "@/server/db";
import { GET as listClients, POST as createClient } from "../route";
import { DELETE, GET, PATCH } from "./route";

async function signedInAccount() {
  const account = await createAccount();
  signInAs(account.user.id);
  return account;
}

describe("/api/v1/clients", () => {
  it("requires authentication and a business", async () => {
    expect((await callRoute(listClients)).status).toBe(401);
  });

  it("creates a client, normalizing optional fields", async () => {
    await signedInAccount();

    const { status, json } = await callRoute(createClient, {
      method: "POST",
      body: {
        name: "  Halcyon Labs ",
        email: "Ana@Halcyon.co",
        phone: "+351 912 004 118",
        taxId: "PT509887412",
        country: "pt",
        currency: "usd",
        company: "",
      },
    });

    expect(status).toBe(201);
    expect(json.data).toMatchObject({
      name: "Halcyon Labs",
      email: "ana@halcyon.co",
      country: "PT",
      currency: "USD",
      company: null,
    });
    expect(json.data.id).toEqual(expect.any(String));
    expect(json.data).not.toHaveProperty("businessId");
    expect(json.data).not.toHaveProperty("deletedAt");
  });

  it("returns field errors for invalid input", async () => {
    await signedInAccount();

    const { status, json } = await callRoute(createClient, {
      method: "POST",
      body: { name: "", email: "not-an-email", country: "ZZ" },
    });

    expect(status).toBe(422);
    expect(Object.keys(json.error.details).sort()).toEqual(["country", "email", "name"]);
  });

  it("paginates, searches and sorts", async () => {
    const { business } = await signedInAccount();
    for (const [name, email, company] of [
      ["Vale Coffee", "ops@valecoffee.com", null],
      ["Halcyon Labs", "ana@halcyon.co", null],
      ["Northwind Café", "maria@northwind.cafe", "Northwind Group"],
      ["Mercado Vivo", "paulo@mercadovivo.br", null],
      ["Pine & Co.", "billing@pineco.com", null],
    ] as const) {
      await createClientRecord(business.id, { name, email, company: company ?? undefined });
    }

    const firstPage = await callRoute(listClients, { path: "/api/v1/clients?limit=2" });
    expect(firstPage.json.data.map((c: { name: string }) => c.name)).toEqual(["Halcyon Labs", "Mercado Vivo"]);
    expect(firstPage.json.pagination).toEqual({ page: 1, limit: 2, total: 5 });

    const lastPage = await callRoute(listClients, { path: "/api/v1/clients?limit=2&page=3" });
    expect(lastPage.json.data.map((c: { name: string }) => c.name)).toEqual(["Vale Coffee"]);

    const descending = await callRoute(listClients, { path: "/api/v1/clients?order=desc&limit=1" });
    expect(descending.json.data[0].name).toBe("Vale Coffee");

    const byEmail = await callRoute(listClients, { path: "/api/v1/clients?q=HALCYON" });
    expect(byEmail.json.data.map((c: { name: string }) => c.name)).toEqual(["Halcyon Labs"]);
    expect(byEmail.json.pagination.total).toBe(1);

    const byCompany = await callRoute(listClients, { path: "/api/v1/clients?q=group" });
    expect(byCompany.json.data.map((c: { name: string }) => c.name)).toEqual(["Northwind Café"]);
  });

  it("rejects unknown sort fields instead of leaking columns", async () => {
    await signedInAccount();
    const { status } = await callRoute(listClients, { path: "/api/v1/clients?sort=businessId" });
    expect(status).toBe(422);
  });
});

describe("/api/v1/clients/:id", () => {
  it("reads, updates and soft-deletes a client", async () => {
    const { business } = await signedInAccount();
    const client = await createClientRecord(business.id, { name: "Pine & Co.", email: "billing@pineco.com" });
    const params = { id: client.id };

    const read = await callRoute(GET, { params });
    expect(read.json.data).toMatchObject({ id: client.id, name: "Pine & Co." });

    const updated = await callRoute(PATCH, { method: "PATCH", params, body: { city: "Portland", email: "" } });
    expect(updated.status).toBe(200);
    expect(updated.json.data).toMatchObject({ name: "Pine & Co.", city: "Portland", email: null });

    const removed = await callRoute(DELETE, { method: "DELETE", params });
    expect(removed.status).toBe(204);
    expect(removed.json).toBeNull();

    expect((await callRoute(GET, { params })).status).toBe(404);
    expect((await callRoute(listClients)).json.pagination.total).toBe(0);
    expect((await callRoute(DELETE, { method: "DELETE", params })).status).toBe(404);

    // The row survives for invoices that reference it.
    expect(await db.client.findUnique({ where: { id: client.id } })).not.toBeNull();
  });

  it("returns 404 for ids that don't exist", async () => {
    await signedInAccount();
    const params = { id: "does-not-exist" };
    expect((await callRoute(GET, { params })).status).toBe(404);
    expect((await callRoute(PATCH, { method: "PATCH", params, body: { name: "X" } })).status).toBe(404);
  });

  it("never exposes another business's client", async () => {
    const owner = await createAccount();
    const victimClient = await createClientRecord(owner.business.id, { name: "Secret Client" });
    await signedInAccount();
    const params = { id: victimClient.id };

    const read = await callRoute(GET, { params });
    expect(read.status).toBe(404);
    expect(read.json.error).toEqual({ code: "RESOURCE_NOT_FOUND", message: "Client not found" });

    expect((await callRoute(PATCH, { method: "PATCH", params, body: { name: "Hijacked" } })).status).toBe(404);
    expect((await callRoute(DELETE, { method: "DELETE", params })).status).toBe(404);
    expect((await callRoute(listClients)).json.data).toEqual([]);

    const untouched = await db.client.findUniqueOrThrow({ where: { id: victimClient.id } });
    expect(untouched).toMatchObject({ name: "Secret Client", deletedAt: null });
  });
});
