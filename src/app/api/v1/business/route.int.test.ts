import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createUser } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { GET as getMe } from "../me/route";
import { GET, PATCH, POST } from "./route";

describe("/api/v1/business", () => {
  it("requires authentication", async () => {
    expect((await callRoute(GET)).status).toBe(401);
    expect((await callRoute(POST, { method: "POST", body: { name: "X" } })).status).toBe(401);
  });

  it("creates the business during onboarding, using the account email", async () => {
    const user = await createUser({ email: "ana@alvorada.studio" });
    signInAs(user.id);

    const { status, json } = await callRoute(POST, {
      method: "POST",
      body: { name: "Alvorada Studio", country: "pt", defaultCurrency: "eur" },
    });

    expect(status).toBe(201);
    expect(json.data).toMatchObject({
      name: "Alvorada Studio",
      email: "ana@alvorada.studio",
      country: "PT",
      defaultCurrency: "EUR",
      invoicePrefix: "INV-",
      invoiceNextNumber: 1,
      paymentTermsDays: 14,
    });
    expect(json.data).not.toHaveProperty("userId");
  });

  it("allows only one business per user", async () => {
    const { user } = await createAccount();
    signInAs(user.id);

    const { status, json } = await callRoute(POST, { method: "POST", body: { name: "Second" } });

    expect(status).toBe(409);
    expect(json.error.code).toBe("CONFLICT");
    expect(await db.business.count()).toBe(1);
  });

  it("returns 404 from GET before onboarding and 403 from PATCH", async () => {
    const user = await createUser();
    signInAs(user.id);

    expect((await callRoute(GET)).status).toBe(404);
    expect((await callRoute(PATCH, { method: "PATCH", body: { name: "X" } })).status).toBe(403);
  });

  it("updates profile and invoice defaults", async () => {
    const { user } = await createAccount();
    signInAs(user.id);

    const { status, json } = await callRoute(PATCH, {
      method: "PATCH",
      body: {
        name: "Alvorada Studio",
        taxId: "PT509887412",
        website: "",
        invoicePrefix: "AS-",
        invoiceNextNumber: 45,
        defaultTaxRate: "23",
        timezone: "Europe/Lisbon",
      },
    });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({
      name: "Alvorada Studio",
      taxId: "PT509887412",
      website: null,
      invoicePrefix: "AS-",
      invoiceNextNumber: 45,
      defaultTaxRate: "23.00",
      timezone: "Europe/Lisbon",
    });
    expect((await callRoute(GET)).json.data.invoicePrefix).toBe("AS-");
  });

  it("rejects invalid updates with field details and changes nothing", async () => {
    const { user, business } = await createAccount();
    signInAs(user.id);

    const { status, json } = await callRoute(PATCH, {
      method: "PATCH",
      body: { name: "", invoiceNextNumber: 0, defaultCurrency: "ABC" },
    });

    expect(status).toBe(422);
    expect(Object.keys(json.error.details).sort()).toEqual(["defaultCurrency", "invoiceNextNumber", "name"]);
    expect((await db.business.findUniqueOrThrow({ where: { id: business.id } })).name).toBe(business.name);
  });
});

describe("GET /api/v1/me", () => {
  it("returns the user without a business before onboarding", async () => {
    const user = await createUser({ email: "ana@alvorada.studio" });
    signInAs(user.id);

    const { status, json } = await callRoute(getMe);

    expect(status).toBe(200);
    expect(json.data).toMatchObject({
      user: { id: user.id, email: "ana@alvorada.studio" },
      business: null,
      subscription: { plan: "FREE", status: "ACTIVE" },
      entitlements: { plan: "FREE", limits: { invoicesPerMonth: 5 } },
    });
  });

  it("includes the business once it exists", async () => {
    const { user, business } = await createAccount({ businessName: "Alvorada Studio" });
    signInAs(user.id);

    const { json } = await callRoute(getMe);

    expect(json.data.business).toMatchObject({ id: business.id, name: "Alvorada Studio" });
  });

  it("returns 401 when the session points at a deleted user", async () => {
    signInAs("cdeleteduser000000000000");
    expect((await callRoute(getMe)).status).toBe(401);
  });
});
