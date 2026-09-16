import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { GET as dashboard } from "@/app/api/v1/dashboard/route";
import { db } from "@/server/db";
import { PATCH } from "../route";
import { POST as cancel } from "../cancel/route";
import { POST as markPaid } from "../mark-paid/route";
import { POST as send } from "../send/route";
import { POST as create } from "../../route";
import { DELETE as removePayment } from "./[paymentId]/route";
import { GET, POST } from "./route";

async function sentInvoice(total = "4260", overrides: Record<string, unknown> = {}) {
  const account = await createAccount();
  signInAs(account.user.id);
  const client = await createClientRecord(account.business.id, { name: "Mercado Vivo" });
  const draft = (await callRoute(create, { method: "POST", body: { clientId: client.id } })).json.data;
  await callRoute(PATCH, {
    method: "PATCH",
    params: { id: draft.id },
    body: { items: [lineInput({ unitPrice: total })], ...overrides },
  });
  const invoice = (await callRoute(send, { method: "POST", params: { id: draft.id } })).json.data;
  return { ...account, invoice };
}

const pay = (id: string, body: Record<string, unknown>, headers?: Record<string, string>) =>
  callRoute(POST, {
    method: "POST",
    params: { id },
    body: { paymentDate: "2026-08-28", method: "BANK_TRANSFER", ...body },
    headers,
  });

describe("invoice payments", () => {
  it("moves from sent to partially paid to paid", async () => {
    const { invoice } = await sentInvoice();

    const partial = await pay(invoice.id, { amount: "2000", reference: "TRF-99413" });
    expect(partial.status).toBe(201);
    expect(partial.json.data).toMatchObject({ status: "PARTIALLY_PAID", amountPaid: "2000.00", amountDue: "2260.00" });
    expect(partial.json.data.payments[0]).toMatchObject({ amount: "2000.00", currency: "USD", reference: "TRF-99413" });

    const rest = await pay(invoice.id, { amount: "2260" });
    expect(rest.json.data).toMatchObject({ status: "PAID", amountDue: "0.00" });
    expect(rest.json.data.events.map((event: { type: string }) => event.type).slice(0, 2)).toEqual([
      "PAYMENT_ADDED",
      "PAYMENT_ADDED",
    ]);

    const listed = await callRoute(GET, { params: { id: invoice.id } });
    expect(listed.json.data).toHaveLength(2);
  });

  it("rejects overpayment, another currency and payments on drafts or cancelled invoices", async () => {
    const { invoice, business } = await sentInvoice("100");

    const over = await pay(invoice.id, { amount: "100.01" });
    expect(over.status).toBe(422);
    expect(over.json.error.details.amount[0]).toBe("Can't exceed the open balance of $100.00");

    const euro = await pay(invoice.id, { amount: "10", currency: "EUR" });
    expect(euro.json.error.details).toEqual({ currency: ["This invoice is in USD"] });

    const draft = (await callRoute(create, { method: "POST" })).json.data;
    expect((await pay(draft.id, { amount: "1" })).status).toBe(409);

    await callRoute(cancel, { method: "POST", params: { id: invoice.id } });
    expect((await pay(invoice.id, { amount: "1" })).status).toBe(409);
    expect(await db.payment.count({ where: { invoice: { businessId: business.id } } })).toBe(0);
  });

  it("records a retried request with the same Idempotency-Key once", async () => {
    const { invoice } = await sentInvoice("1000");
    const headers = { "idempotency-key": "retry-key-123" };

    await Promise.all([pay(invoice.id, { amount: "400" }, headers), pay(invoice.id, { amount: "400" }, headers)]);
    const again = await pay(invoice.id, { amount: "400" }, headers);

    expect(again.json.data).toMatchObject({ amountPaid: "400.00", status: "PARTIALLY_PAID" });
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });

  it("never lets concurrent payments exceed the total", async () => {
    const { invoice } = await sentInvoice("1000");

    const results = await Promise.all([pay(invoice.id, { amount: "700" }), pay(invoice.id, { amount: "700" })]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 422]);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).amountPaid.toFixed(2)).toBe("700.00");
  });

  it("removing a payment reopens the invoice", async () => {
    const { invoice } = await sentInvoice("500");
    const paid = (await pay(invoice.id, { amount: "500" })).json.data;
    await db.invoice.update({ where: { id: invoice.id }, data: { viewedAt: new Date() } });

    const { json } = await callRoute(removePayment, {
      method: "DELETE",
      params: { id: invoice.id, paymentId: paid.payments[0].id },
    });

    expect(json.data).toMatchObject({ status: "VIEWED", amountPaid: "0.00", amountDue: "500.00", payments: [] });
  });

  it("mark-paid settles the open balance", async () => {
    const { invoice } = await sentInvoice("750");
    await pay(invoice.id, { amount: "250" });

    const { json } = await callRoute(markPaid, { method: "POST", params: { id: invoice.id } });

    expect(json.data).toMatchObject({ status: "PAID", amountDue: "0.00" });
    expect(json.data.payments[0]).toMatchObject({ amount: "500.00", method: "BANK_TRANSFER" });
  });
});

describe("GET /api/v1/dashboard", () => {
  it("reports each currency separately and never adds them up", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { invoice, business, user } = await sentInvoice("4260");
    await pay(invoice.id, { amount: "2000", paymentDate: today });

    const client = await createClientRecord(business.id, { name: "Northwind Café" });
    signInAs(user.id);
    const euroDraft = (await callRoute(create, { method: "POST", body: { clientId: client.id } })).json.data;
    await callRoute(PATCH, {
      method: "PATCH",
      params: { id: euroDraft.id },
      body: { currency: "EUR", issueDate: "2026-01-01", dueDate: "2026-01-10", items: [lineInput({ unitPrice: "1980" })] },
    });
    await callRoute(send, { method: "POST", params: { id: euroDraft.id } });

    const usd = (await callRoute(dashboard, { path: "/api/v1/dashboard" })).json.data;
    expect(usd).toMatchObject({
      currency: "USD",
      otherCurrencies: ["EUR"],
      paidThisMonth: { amount: "2000.00" },
      outstanding: { amount: "2260.00", count: 1 },
    });

    const eur = (await callRoute(dashboard, { path: "/api/v1/dashboard?currency=eur" })).json.data;
    expect(eur).toMatchObject({
      currency: "EUR",
      otherCurrencies: ["USD"],
      paidThisMonth: { amount: "0.00" },
      outstanding: { amount: "1980.00", count: 1 },
      overdue: { amount: "1980.00", count: 1 },
    });
    expect(eur.overdue.oldestDays).toBeGreaterThan(0);
  });
});
