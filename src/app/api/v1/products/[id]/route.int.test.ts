import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createProductRecord } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { db } from "@/server/db";
import { GET as listProducts, POST as createProduct } from "../route";
import { DELETE, GET, PATCH } from "./route";

async function signedInAccount() {
  const account = await createAccount();
  signInAs(account.user.id);
  return account;
}

describe("/api/v1/products", () => {
  it("creates a product and keeps decimals exact", async () => {
    await signedInAccount();

    const { status, json } = await callRoute(createProduct, {
      method: "POST",
      body: {
        name: "Monthly retainer",
        description: "Design support, up to 20 hours",
        unit: "per month",
        unitPrice: "5200.1",
        taxRate: "23",
        currency: "EUR",
      },
    });

    expect(status).toBe(201);
    expect(json.data).toMatchObject({
      name: "Monthly retainer",
      unit: "per month",
      unitPrice: "5200.10",
      taxRate: "23.00",
      taxExempt: false,
      taxExemptReason: null,
      currency: "EUR",
    });
  });

  it("stores the largest supported amount without rounding", async () => {
    await signedInAccount();
    const { json } = await callRoute(createProduct, {
      method: "POST",
      body: { name: "Big", unitPrice: "9999999999.99" },
    });
    expect(json.data.unitPrice).toBe("9999999999.99");
  });

  it("requires an exemption reason", async () => {
    await signedInAccount();

    const { status, json } = await callRoute(createProduct, {
      method: "POST",
      body: { name: "Handoff & QA support", unitPrice: "140", taxExempt: true },
    });

    expect(status).toBe(422);
    expect(json.error.details).toEqual({
      taxExemptReason: ["An exemption reason is required — it prints on the PDF"],
    });
    expect(await db.product.count()).toBe(0);
  });

  it("searches name and description and sorts by price", async () => {
    const { business } = await signedInAccount();
    await createProductRecord(business.id, { name: "UI design", unitPrice: "320.00", description: "Per screen" });
    await createProductRecord(business.id, { name: "Retainer", unitPrice: "5200.00" });
    await createProductRecord(business.id, { name: "QA support", unitPrice: "140.00" });

    const byPrice = await callRoute(listProducts, { path: "/api/v1/products?sort=unitPrice&order=desc" });
    expect(byPrice.json.data.map((p: { unitPrice: string }) => p.unitPrice)).toEqual(["5200.00", "320.00", "140.00"]);

    const search = await callRoute(listProducts, { path: "/api/v1/products?q=screen" });
    expect(search.json.data.map((p: { name: string }) => p.name)).toEqual(["UI design"]);
  });
});

describe("/api/v1/products/:id", () => {
  it("updates a price without touching other fields", async () => {
    const { business } = await signedInAccount();
    const product = await createProductRecord(business.id, { name: "Retainer", unitPrice: "5000.00" });

    const { status, json } = await callRoute(PATCH, {
      method: "PATCH",
      params: { id: product.id },
      body: { unitPrice: 5200 },
    });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({ name: "Retainer", unitPrice: "5200.00" });
  });

  it("checks the exemption rule against the state after the patch", async () => {
    const { business } = await signedInAccount();
    const product = await createProductRecord(business.id, { name: "Retainer" });
    const params = { id: product.id };

    const missingReason = await callRoute(PATCH, { method: "PATCH", params, body: { taxExempt: true } });
    expect(missingReason.status).toBe(422);
    expect(missingReason.json.error.details).toHaveProperty("taxExemptReason");

    const exempt = await callRoute(PATCH, {
      method: "PATCH",
      params,
      body: { taxExempt: true, taxExemptReason: "Art. 53 CIVA" },
    });
    expect(exempt.json.data).toMatchObject({ taxExempt: true, taxExemptReason: "Art. 53 CIVA" });

    const clearReason = await callRoute(PATCH, { method: "PATCH", params, body: { taxExemptReason: "" } });
    expect(clearReason.status).toBe(422);

    const vatOnExempt = await callRoute(PATCH, { method: "PATCH", params, body: { taxRate: "23" } });
    expect(vatOnExempt.json.error.details).toEqual({ taxRate: ["Exempt items can't carry VAT"] });

    const notExempt = await callRoute(PATCH, {
      method: "PATCH",
      params,
      body: { taxExempt: false, taxRate: "23" },
    });
    expect(notExempt.json.data).toMatchObject({ taxExempt: false, taxRate: "23.00", taxExemptReason: null });
  });

  it("soft-deletes and hides the product", async () => {
    const { business } = await signedInAccount();
    const product = await createProductRecord(business.id, { name: "Retainer" });
    const params = { id: product.id };

    expect((await callRoute(DELETE, { method: "DELETE", params })).status).toBe(204);
    expect((await callRoute(GET, { params })).status).toBe(404);
    expect((await callRoute(listProducts)).json.data).toEqual([]);
  });

  it("never exposes another business's product", async () => {
    const owner = await createAccount();
    const product = await createProductRecord(owner.business.id, { name: "Secret", unitPrice: "1.00" });
    await signedInAccount();
    const params = { id: product.id };

    expect((await callRoute(GET, { params })).status).toBe(404);
    expect((await callRoute(PATCH, { method: "PATCH", params, body: { unitPrice: "0" } })).status).toBe(404);
    expect((await callRoute(DELETE, { method: "DELETE", params })).status).toBe(404);

    const untouched = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(untouched.unitPrice.toFixed(2)).toBe("1.00");
    expect(untouched.deletedAt).toBeNull();
  });
});
