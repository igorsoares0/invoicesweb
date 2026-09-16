import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, createProductRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { db } from "@/server/db";
import { DELETE, GET as getInvoice, PATCH } from "./[id]/route";
import { POST as cancel } from "./[id]/cancel/route";
import { POST as duplicate } from "./[id]/duplicate/route";
import { DELETE as revokeLink, POST as createLink } from "./[id]/public-link/route";
import { POST as send } from "./[id]/send/route";
import { GET as list, POST as create } from "./route";

async function signedInAccount() {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  signInAs(account.user.id);
  const client = await createClientRecord(account.business.id, { name: "Pine & Co.", email: "billing@pineco.com" });
  return { ...account, client };
}

async function newDraft(body?: unknown) {
  const response = await callRoute(create, { method: "POST", body });
  expect(response.status).toBe(201);
  return response.json.data;
}

async function readyDraft(clientId: string, lines = [lineInput()]) {
  const draft = await newDraft({ clientId });
  const { json } = await callRoute(PATCH, { method: "PATCH", params: { id: draft.id }, body: { items: lines } });
  return json.data;
}

describe("POST /api/v1/invoices", () => {
  it("creates a numbered draft with dates from the business terms", async () => {
    const { business } = await signedInAccount();
    await db.business.update({ where: { id: business.id }, data: { invoiceNextNumber: 44, paymentTermsDays: 14 } });

    const draft = await newDraft();

    expect(draft).toMatchObject({
      number: "INV-0044",
      sequence: 44,
      status: "DRAFT",
      displayStatus: "DRAFT",
      currency: "USD",
      total: "0.00",
      client: null,
      items: [],
      publicToken: null,
    });
    const days = (Date.parse(draft.dueDate) - Date.parse(draft.issueDate)) / 86_400_000;
    expect(days).toBe(14);
    expect(draft.issues.map((issue: { path: string }) => issue.path)).toEqual(["clientId", "items"]);
    expect(draft.events.map((event: { type: string }) => event.type)).toEqual(["CREATED"]);
    expect((await db.business.findUniqueOrThrow({ where: { id: business.id } })).invoiceNextNumber).toBe(45);
  });

  it("never hands out the same number twice, even under concurrency", async () => {
    await signedInAccount();

    const responses = await Promise.all(Array.from({ length: 20 }, () => callRoute(create, { method: "POST" })));

    const numbers = responses.map((response) => response.json.data.sequence).sort((a: number, b: number) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("starts from a client and catalog items, using the client's currency", async () => {
    const { business } = await signedInAccount();
    const euroClient = await createClientRecord(business.id, { name: "Northwind Café" });
    await db.client.update({ where: { id: euroClient.id }, data: { currency: "EUR" } });
    const product = await createProductRecord(business.id, { name: "Brand sprint", unitPrice: "4260.00" });
    await db.product.update({ where: { id: product.id }, data: { taxRate: "23" } });

    const draft = await newDraft({ clientId: euroClient.id, productIds: [product.id] });

    expect(draft).toMatchObject({ currency: "EUR", client: { name: "Northwind Café" }, subtotal: "4260.00", tax: "979.80", total: "5239.80" });
    expect(draft.items[0]).toMatchObject({ description: "Brand sprint", productId: product.id, unitPrice: "4260.00" });
  });

  it("rejects clients and products from another business", async () => {
    const other = await createAccount();
    const foreignClient = await createClientRecord(other.business.id, { name: "Secret" });
    await signedInAccount();

    const response = await callRoute(create, { method: "POST", body: { clientId: foreignClient.id } });

    expect(response.status).toBe(422);
    expect(response.json.error.details).toEqual({ clientId: ["Client not found"] });
  });
});

describe("PATCH /api/v1/invoices/:id (draft autosave)", () => {
  it("replaces the lines and recalculates everything on the server", async () => {
    const { client } = await signedInAccount();
    const draft = await newDraft();

    const { status, json } = await callRoute(PATCH, {
      method: "PATCH",
      params: { id: draft.id },
      body: {
        clientId: client.id,
        notes: "Thanks for the work this quarter.",
        template: "CLASSIC",
        color: "#15803d",
        items: [
          lineInput({ id: "line_aaaaaaaa", quantity: "1", unitPrice: "2400" }),
          lineInput({ id: "line_bbbbbbbb", description: "UI design — 12 screens", quantity: "12", unitPrice: "320" }),
          lineInput({
            id: "line_cccccccc",
            description: "Handoff & QA support",
            quantity: "6",
            unitPrice: "140",
            discountType: "PERCENT",
            discountValue: "10",
          }),
        ],
      },
    });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({
      subtotal: "7080.00",
      discount: "84.00",
      tax: "0.00",
      total: "6996.00",
      amountDue: "6996.00",
      template: "CLASSIC",
      color: "#15803d",
      client: { id: client.id, email: "billing@pineco.com" },
      issues: [],
    });
    expect(json.data.items.map((item: { id: string; total: string }) => [item.id, item.total])).toEqual([
      ["line_aaaaaaaa", "2400.00"],
      ["line_bbbbbbbb", "3840.00"],
      ["line_cccccccc", "756.00"],
    ]);

    const reordered = await callRoute(PATCH, {
      method: "PATCH",
      params: { id: draft.id },
      body: { items: [json.data.items[2], json.data.items[0]] },
    });
    expect(reordered.json.data.items.map((item: { id: string }) => item.id)).toEqual(["line_cccccccc", "line_aaaaaaaa"]);
    expect(reordered.json.data.total).toBe("3156.00");
  });

  it("ignores client-sent totals", async () => {
    await signedInAccount();
    const draft = await newDraft();

    const { json } = await callRoute(PATCH, {
      method: "PATCH",
      params: { id: draft.id },
      body: { total: "1.00", items: [{ ...lineInput({ unitPrice: "100" }), total: "1.00" }] },
    });

    expect(json.data.total).toBe("100.00");
  });

  it("saves incomplete drafts and reports what blocks sending", async () => {
    const { client } = await signedInAccount();
    const draft = await newDraft({ clientId: client.id });

    const { status, json } = await callRoute(PATCH, {
      method: "PATCH",
      params: { id: draft.id },
      body: {
        issueDate: "2026-09-12",
        dueDate: "2026-09-05",
        items: [lineInput({ id: "line_price01" }), lineInput({ id: "line_price02", description: "Site survey visit", unitPrice: null })],
      },
    });

    expect(status).toBe(200);
    expect(json.data.issues.map((issue: { path: string }) => issue.path)).toEqual(["items.line_price02.unitPrice", "dueDate"]);
  });

  it("refuses to edit an invoice that was sent", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });

    const response = await callRoute(PATCH, { method: "PATCH", params: { id: draft.id }, body: { notes: "Changed" } });

    expect(response.status).toBe(409);
    expect(response.json.error.code).toBe("INVALID_STATUS_TRANSITION");
  });
});

describe("POST /api/v1/invoices/:id/send", () => {
  it("returns field details when the draft isn't ready and leaves it untouched", async () => {
    await signedInAccount();
    const draft = await newDraft();

    const response = await callRoute(send, { method: "POST", params: { id: draft.id } });

    expect(response.status).toBe(422);
    expect(Object.keys(response.json.error.details)).toEqual(["clientId", "items"]);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("DRAFT");
  });

  it("marks as sent, publishes an unguessable link and freezes the client", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const { status, json } = await callRoute(send, { method: "POST", params: { id: draft.id } });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({ status: "SENT", number: draft.number, amountDue: "2400.00" });
    expect(json.data.publicToken).toMatch(/^inv_[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(json.data.events.map((event: { type: string }) => event.type)).toEqual(["SENT", "CREATED"]);

    await db.client.update({ where: { id: client.id }, data: { name: "Renamed Co." } });
    const stored = await db.invoice.findUniqueOrThrow({ where: { id: draft.id } });
    expect(stored.billToSnapshot).toMatchObject({ name: "Pine & Co.", email: "billing@pineco.com" });
    expect(stored.issuerSnapshot).toMatchObject({ name: "Alvorada Studio" });

    expect((await callRoute(send, { method: "POST", params: { id: draft.id } })).status).toBe(409);
  });
});

describe("invoice actions", () => {
  it("duplicates into a new numbered draft with fresh line ids", async () => {
    const { client } = await signedInAccount();
    const source = await readyDraft(client.id, [lineInput({ id: "line_original", unitPrice: "320", quantity: "12" })]);
    await callRoute(send, { method: "POST", params: { id: source.id } });

    const { status, json } = await callRoute(duplicate, { method: "POST", params: { id: source.id } });

    expect(status).toBe(201);
    expect(json.data).toMatchObject({ status: "DRAFT", sequence: source.sequence + 1, total: "3840.00", publicToken: null });
    expect(json.data.items[0].id).not.toBe("line_original");
    expect(json.data.events.map((event: { type: string }) => event.type)).toContain("DUPLICATED");
  });

  it("cancels a sent invoice and kills its public link", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });

    const { json } = await callRoute(cancel, { method: "POST", params: { id: draft.id } });

    expect(json.data).toMatchObject({ status: "CANCELLED", publicToken: null });
    expect((await callRoute(createLink, { method: "POST", params: { id: draft.id } })).status).toBe(409);
  });

  it("revokes a link and can issue a new one", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    const sent = (await callRoute(send, { method: "POST", params: { id: draft.id } })).json.data;

    const revoked = await callRoute(revokeLink, { method: "DELETE", params: { id: draft.id } });
    expect(revoked.json.data.publicToken).toBeNull();
    expect((await callRoute(revokeLink, { method: "DELETE", params: { id: draft.id } })).status).toBe(409);

    const renewed = await callRoute(createLink, { method: "POST", params: { id: draft.id } });
    expect(renewed.json.data.publicToken).toMatch(/^inv_/);
    expect(renewed.json.data.publicToken).not.toBe(sent.publicToken);
  });

  it("deletes drafts only, leaving a gap in the sequence", async () => {
    const { client, business } = await signedInAccount();
    const draft = await newDraft();
    expect((await callRoute(DELETE, { method: "DELETE", params: { id: draft.id } })).status).toBe(204);
    expect((await newDraft()).sequence).toBe(draft.sequence + 1);

    const sent = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: sent.id } });
    expect((await callRoute(DELETE, { method: "DELETE", params: { id: sent.id } })).status).toBe(409);
    expect(await db.invoice.count({ where: { businessId: business.id } })).toBe(2);
  });
});

describe("GET /api/v1/invoices", () => {
  it("filters by status, including derived overdue, and searches clients and lines", async () => {
    const { client, business } = await signedInAccount();
    const other = await createClientRecord(business.id, { name: "Halcyon Labs" });
    const today = new Date().toISOString().slice(0, 10);

    const draft = await newDraft({ clientId: other.id });
    const current = await readyDraft(client.id, [lineInput({ description: "Menu system" })]);
    await callRoute(send, { method: "POST", params: { id: current.id } });
    const late = await readyDraft(other.id, [lineInput({ description: "Brand sprint" })]);
    await callRoute(PATCH, { method: "PATCH", params: { id: late.id }, body: { issueDate: "2026-01-01", dueDate: "2026-01-15" } });
    await callRoute(send, { method: "POST", params: { id: late.id } });

    const numbers = async (path: string) =>
      (await callRoute(list, { path })).json.data.map((invoice: { number: string }) => invoice.number);

    expect(await numbers("/api/v1/invoices")).toEqual([late.number, current.number, draft.number]);
    expect(await numbers("/api/v1/invoices?status=draft")).toEqual([draft.number]);
    expect(await numbers("/api/v1/invoices?status=sent")).toEqual([current.number]);
    expect(await numbers("/api/v1/invoices?status=overdue")).toEqual([late.number]);
    expect(await numbers("/api/v1/invoices?q=halcyon")).toEqual([late.number, draft.number]);
    expect(await numbers("/api/v1/invoices?q=menu")).toEqual([current.number]);

    const lateRow = (await callRoute(list, { path: "/api/v1/invoices?status=overdue" })).json.data[0];
    expect(lateRow).toMatchObject({ displayStatus: "OVERDUE", summary: "Brand sprint", client: { name: "Halcyon Labs" } });
    expect(lateRow.dueDate < today).toBe(true);
  });

  it("never lists or opens another business's invoices", async () => {
    const owner = await signedInAccount();
    const secret = await newDraft({ clientId: owner.client.id });

    const intruder = await createAccount();
    signInAs(intruder.user.id);

    expect((await callRoute(list)).json.data).toEqual([]);
    for (const [handler, method] of [
      [getInvoice, "GET"],
      [PATCH, "PATCH"],
      [DELETE, "DELETE"],
      [send, "POST"],
      [cancel, "POST"],
      [duplicate, "POST"],
      [revokeLink, "DELETE"],
    ] as const) {
      const response = await callRoute(handler, { method, params: { id: secret.id }, body: method === "PATCH" ? { notes: "x" } : undefined });
      expect(response.status, `${method} ${handler.name}`).toBe(404);
    }
    expect(await db.invoice.count()).toBe(1);
  });
});
