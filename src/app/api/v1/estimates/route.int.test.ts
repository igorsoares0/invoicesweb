import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { POST as createInvoice } from "@/app/api/v1/invoices/route";
import { db } from "@/server/db";
import { POST as accept } from "./[id]/accept/route";
import { POST as convert } from "./[id]/convert/route";
import { POST as decline } from "./[id]/decline/route";
import { POST as duplicate } from "./[id]/duplicate/route";
import { POST as reopen } from "./[id]/reopen/route";
import { DELETE, GET as getEstimate, PATCH } from "./[id]/route";
import { POST as send } from "./[id]/send/route";
import { GET as list, POST as create } from "./route";
import { GET as summary } from "./summary/route";

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

async function sentEstimate(clientId: string, lines = [lineInput({ unitPrice: "2400" })], extra: Record<string, unknown> = {}) {
  const draft = await newDraft({ clientId });
  await callRoute(PATCH, { method: "PATCH", params: { id: draft.id }, body: { items: lines, ...extra } });
  const { status, json } = await callRoute(send, { method: "POST", params: { id: draft.id } });
  expect(status).toBe(200);
  return json.data;
}

const post = (handler: typeof accept, id: string, body?: unknown) => callRoute(handler, { method: "POST", params: { id }, body });

describe("POST /api/v1/estimates", () => {
  it("numbers estimates on their own sequence, valid for the business's validity period", async () => {
    const { business } = await signedInAccount();
    await db.business.update({ where: { id: business.id }, data: { estimateNextNumber: 14, estimateValidityDays: 30 } });
    await callRoute(createInvoice, { method: "POST" });

    const draft = await newDraft();

    expect(draft).toMatchObject({ number: "EST-0014", sequence: 14, status: "DRAFT", displayStatus: "DRAFT" });
    expect((Date.parse(draft.expiryDate) - Date.parse(draft.issueDate)) / 86_400_000).toBe(30);
    expect(draft.issues.map((issue: { path: string }) => issue.path)).toEqual(["clientId", "items"]);
    const numbers = await Promise.all(Array.from({ length: 10 }, () => callRoute(create, { method: "POST" })));
    expect(new Set(numbers.map((response) => response.json.data.sequence)).size).toBe(10);
  });
});

describe("estimate lifecycle", () => {
  it("saves drafts and reports expiry problems by name", async () => {
    await signedInAccount();
    const draft = await newDraft();

    const { json } = await callRoute(PATCH, {
      method: "PATCH",
      params: { id: draft.id },
      body: { issueDate: "2026-09-12", expiryDate: "2026-09-01", terms: "Valid for 14 days.", items: [lineInput({ unitPrice: "100", taxRate: "23" })] },
    });

    expect(json.data).toMatchObject({ total: "123.00", terms: "Valid for 14 days." });
    expect(json.data.issues).toContainEqual(expect.objectContaining({ path: "expiryDate", summary: "Expiry date is before the issue date" }));
  });

  it("sends, then locks the estimate against edits", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(client.id);

    expect(estimate).toMatchObject({ status: "SENT", total: "2400.00" });
    expect(estimate.publicToken).toMatch(/^est_[0-9A-HJKMNP-TV-Z]{20}$/);
    expect((await callRoute(PATCH, { method: "PATCH", params: { id: estimate.id }, body: { notes: "x" } })).status).toBe(409);
    expect((await callRoute(DELETE, { method: "DELETE", params: { id: estimate.id } })).status).toBe(409);
    expect((await post(send, estimate.id)).status).toBe(409);
  });

  it("records replies once and refuses to flip them", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(client.id);

    const accepted = await post(accept, estimate.id);
    expect(accepted.json.data).toMatchObject({ status: "ACCEPTED", respondedBy: "you" });
    expect(accepted.json.data.acceptedAt).not.toBeNull();

    const again = await post(accept, estimate.id);
    expect(again.status).toBe(200);
    expect(again.json.data.events.filter((event: { type: string }) => event.type === "ACCEPTED")).toHaveLength(1);

    const flip = await post(decline, estimate.id);
    expect(flip.status).toBe(409);
  });

  it("reopens a declined estimate for a new reply", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(client.id);

    await post(decline, estimate.id);
    const reopened = await post(reopen, estimate.id);

    expect(reopened.json.data).toMatchObject({ status: "SENT", declinedAt: null, respondedBy: null });
    expect((await post(accept, estimate.id)).json.data.status).toBe("ACCEPTED");
  });

  it("expires on the day after the expiry date and can't be accepted then", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(client.id);
    await db.estimate.update({ where: { id: estimate.id }, data: { expiryDate: new Date("2026-01-01T00:00:00Z") } });

    const read = await callRoute(getEstimate, { params: { id: estimate.id } });
    expect(read.json.data).toMatchObject({ status: "SENT", displayStatus: "EXPIRED" });

    const refused = await post(accept, estimate.id);
    expect(refused.status).toBe(409);
    expect(refused.json.error.message).toBe("This estimate has expired.");

    const expired = await callRoute(list, { path: "/api/v1/estimates?status=expired" });
    expect(expired.json.data.map((row: { id: string }) => row.id)).toEqual([estimate.id]);
    expect((await callRoute(list, { path: "/api/v1/estimates?status=sent" })).json.data).toEqual([]);
  });

  it("duplicates into a new draft", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(client.id, [lineInput({ description: "Brand sprint", unitPrice: "4260" })]);

    const { status, json } = await post(duplicate, estimate.id);

    expect(status).toBe(201);
    expect(json.data).toMatchObject({ status: "DRAFT", total: "4260.00", client: { id: client.id } });
    expect(json.data.number).not.toBe(estimate.number);
  });

  it("filters by status and never exposes another business's estimates", async () => {
    const { client } = await signedInAccount();
    const draft = await newDraft();
    const accepted = await sentEstimate(client.id);
    await post(accept, accepted.id);

    const ids = async (status: string) =>
      (await callRoute(list, { path: `/api/v1/estimates?status=${status}` })).json.data.map((row: { id: string }) => row.id);
    expect(await ids("draft")).toEqual([draft.id]);
    expect(await ids("accepted")).toEqual([accepted.id]);

    const intruder = await createAccount();
    signInAs(intruder.user.id);
    expect((await callRoute(list)).json.data).toEqual([]);
    for (const [handler, method] of [
      [getEstimate, "GET"],
      [PATCH, "PATCH"],
      [DELETE, "DELETE"],
      [send, "POST"],
      [accept, "POST"],
      [convert, "POST"],
      [duplicate, "POST"],
    ] as const) {
      const body = method === "PATCH" ? { notes: "x" } : method === "POST" ? { issueDate: "2026-09-12", dueDate: "2026-09-26" } : undefined;
      expect((await callRoute(handler, { method, params: { id: accepted.id }, body })).status, method).toBe(404);
    }
  });
});

describe("POST /api/v1/estimates/:id/convert", () => {
  const dates = { issueDate: "2026-09-12", dueDate: "2026-09-26" };

  it("creates a draft invoice with the same lines and marks the estimate converted", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(
      client.id,
      [
        lineInput({ description: "Website redesign", unitPrice: "2400" }),
        lineInput({ description: "Handoff & QA", quantity: "6", unitPrice: "140", discountType: "PERCENT", discountValue: "10", taxRate: "23" }),
      ],
      { notes: "Thanks", terms: "50% on kickoff", template: "BOLD", color: "#15803d" },
    );
    await post(accept, estimate.id);

    const { status, json } = await post(convert, estimate.id, dates);

    expect(status).toBe(201);
    const { invoice, estimate: converted } = json.data;
    expect(invoice).toMatchObject({
      status: "DRAFT",
      issueDate: "2026-09-12",
      dueDate: "2026-09-26",
      client: { id: client.id },
      notes: "Thanks",
      terms: "50% on kickoff",
      template: "BOLD",
      color: "#15803d",
      subtotal: estimate.subtotal,
      discount: estimate.discount,
      tax: estimate.tax,
      total: estimate.total,
      fromEstimate: { id: estimate.id, number: estimate.number },
      issues: [],
    });
    expect(invoice.number).toMatch(/^INV-/);
    expect(invoice.items.map((item: { description: string; total: string }) => [item.description, item.total])).toEqual(
      estimate.items.map((item: { description: string; total: string }) => [item.description, item.total]),
    );
    expect(converted).toMatchObject({ status: "CONVERTED", convertedInvoice: { id: invoice.id, number: invoice.number } });
    expect(converted.events[0]).toMatchObject({ type: "CONVERTED", metadata: { invoiceNumber: invoice.number } });
  });

  it("only converts accepted estimates, once, even when clicked twice at the same time", async () => {
    const { client, business } = await signedInAccount();
    const estimate = await sentEstimate(client.id);

    expect((await post(convert, estimate.id, dates)).status).toBe(409);
    await post(accept, estimate.id);

    const results = await Promise.all([post(convert, estimate.id, dates), post(convert, estimate.id, dates)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await db.invoice.count({ where: { businessId: business.id } })).toBe(1);
  });

  it("can convert again if the invoice it created was deleted", async () => {
    const { client } = await signedInAccount();
    const estimate = await sentEstimate(client.id);
    await post(accept, estimate.id);
    const first = (await post(convert, estimate.id, dates)).json.data.invoice;

    await db.invoice.delete({ where: { id: first.id } });

    const second = await post(convert, estimate.id, dates);
    expect(second.status).toBe(201);
    expect(second.json.data.invoice.id).not.toBe(first.id);
  });

  it("sends the invoice right away when asked, or converts nothing if it can't be sent", async () => {
    const { client, business } = await signedInAccount();
    const estimate = await sentEstimate(client.id);
    await post(accept, estimate.id);

    const badDates = await post(convert, estimate.id, { issueDate: "2026-09-12", dueDate: "2026-09-01", send: true });
    expect(badDates.status).toBe(422);

    await db.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
    const noClient = await post(convert, estimate.id, { ...dates, send: true });
    expect(noClient.status).toBe(422);
    expect(await db.invoice.count({ where: { businessId: business.id } })).toBe(0);
    expect((await db.estimate.findUniqueOrThrow({ where: { id: estimate.id } })).status).toBe("ACCEPTED");

    await db.client.update({ where: { id: client.id }, data: { deletedAt: null } });
    const sent = await post(convert, estimate.id, { ...dates, send: true });
    expect(sent.json.data.invoice).toMatchObject({ status: "SENT" });
    expect(sent.json.data.invoice.publicToken).toMatch(/^inv_/);
  });
});

describe("GET /api/v1/estimates/summary", () => {
  it("summarizes replies for one currency", async () => {
    const { client } = await signedInAccount();
    await sentEstimate(client.id, [lineInput({ unitPrice: "3150" })]);
    const accepted = await sentEstimate(client.id, [lineInput({ unitPrice: "6996" })]);
    await post(accept, accepted.id);
    const declined = await sentEstimate(client.id, [lineInput({ unitPrice: "2480" })]);
    await post(decline, declined.id);
    await sentEstimate(client.id, [lineInput({ unitPrice: "900" })], { currency: "EUR" });

    const { json } = await callRoute(summary, { path: "/api/v1/estimates/summary" });

    expect(json.data).toMatchObject({
      currency: "USD",
      otherCurrencies: ["EUR"],
      awaitingReply: { amount: "3150.00", count: 1 },
      acceptedNotInvoiced: { amount: "6996.00", count: 1 },
      wonThisQuarter: { percent: 50, accepted: 1, decided: 2 },
      averageReplyDays: 0,
      readyToConvert: { id: accepted.id, number: accepted.number, clientName: "Pine & Co." },
    });
  });
});

describe("settings", () => {
  it("won't move the estimate counter back onto a used number", async () => {
    await signedInAccount();
    await newDraft();
    const { PATCH: updateBusiness } = await import("@/app/api/v1/business/route");

    const response = await callRoute(updateBusiness, { method: "PATCH", body: { estimateNextNumber: 1, estimateValidityDays: 30 } });

    expect(response.status).toBe(422);
    expect(response.json.error.details.estimateNextNumber[0]).toBe("Must be 2 or more — 1 is already used");
  });
});
