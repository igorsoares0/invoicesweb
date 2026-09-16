import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { PATCH } from "@/app/api/v1/invoices/[id]/route";
import { POST as cancel } from "@/app/api/v1/invoices/[id]/cancel/route";
import { POST as recordPayment } from "@/app/api/v1/invoices/[id]/payments/route";
import { DELETE as revokeLink } from "@/app/api/v1/invoices/[id]/public-link/route";
import { POST as send } from "@/app/api/v1/invoices/[id]/send/route";
import { POST as create } from "@/app/api/v1/invoices/route";
import { GET as publicPdf } from "@/app/i/[token]/pdf/route";
import { db } from "@/server/db";
import { publicInvoiceService } from "./public-invoice-service";

async function sentInvoice(dates?: { issueDate: string; dueDate: string }) {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  signInAs(account.user.id);
  await db.business.update({
    where: { id: account.business.id },
    data: { email: "hello@alvorada.studio", paymentInstructions: "IBAN PT50 0002 0123 1234 5678 9015 4" },
  });
  const client = await createClientRecord(account.business.id, { name: "Pine & Co.", email: "billing@pineco.com" });
  const draft = (await callRoute(create, { method: "POST", body: { clientId: client.id } })).json.data;
  await callRoute(PATCH, {
    method: "PATCH",
    params: { id: draft.id },
    body: { items: [lineInput({ unitPrice: "6996" })], notes: "Internal-looking note", ...dates },
  });
  const invoice = (await callRoute(send, { method: "POST", params: { id: draft.id } })).json.data;
  return { ...account, invoice, token: invoice.publicToken as string };
}

const pdf = (token: string, ip = "198.51.100.1") =>
  publicPdf(new Request(`http://localhost/i/${token}/pdf`, { headers: { "x-forwarded-for": ip } }), {
    params: Promise.resolve({ token }),
  });

describe("publicInvoiceService.find", () => {
  it("returns only what the client needs to see", async () => {
    const { token, invoice } = await sentInvoice();

    const found = await publicInvoiceService.find(token);

    expect(found).toMatchObject({
      number: invoice.number,
      template: "MODERN",
      status: { label: "Invoice sent", tone: "sent" },
      issuerName: "Alvorada Studio",
      issuerEmail: "hello@alvorada.studio",
    });
    expect(found?.dueLabel).toMatch(/^Due (in \d+ days|today)$/);
    expect(found?.view.totals.amountDue).toBe("$6,996.00");
    expect(found?.view.paymentInstructions).toContain("IBAN");
    const serialized = JSON.stringify(found);
    expect(serialized).not.toContain(invoice.id);
    expect(serialized).not.toContain("businessId");
  });

  it("labels overdue and partially paid invoices", async () => {
    const { token, invoice } = await sentInvoice({ issueDate: "2026-01-01", dueDate: "2026-01-15" });
    expect(await publicInvoiceService.find(token)).toMatchObject({ status: { tone: "overdue" } });

    await callRoute(recordPayment, {
      method: "POST",
      params: { id: invoice.id },
      body: { amount: "6996", paymentDate: "2026-02-01", method: "CARD" },
    });
    expect(await publicInvoiceService.find(token)).toMatchObject({ status: { label: "Paid" }, dueLabel: "Paid in full" });
  });

  it("treats malformed, unknown, revoked and cancelled links the same", async () => {
    const { token, invoice } = await sentInvoice();
    expect(await publicInvoiceService.find("not-a-token")).toBeNull();
    expect(await publicInvoiceService.find("inv_0000000000000000000A")).toBeNull();

    await callRoute(revokeLink, { method: "DELETE", params: { id: invoice.id } });
    expect(await publicInvoiceService.find(token)).toBeNull();

    const other = await sentInvoice();
    await callRoute(cancel, { method: "POST", params: { id: other.invoice.id } });
    expect(await publicInvoiceService.find(other.token)).toBeNull();
  });
});

describe("publicInvoiceService.recordView", () => {
  it("marks the invoice viewed once, with a single history event", async () => {
    const { token, invoice } = await sentInvoice();

    await Promise.all([publicInvoiceService.recordView(token, null), publicInvoiceService.recordView(token, null)]);
    await publicInvoiceService.recordView(token, null);

    const stored = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { events: true } });
    expect(stored.status).toBe("VIEWED");
    expect(stored.viewedAt).not.toBeNull();
    expect(stored.events.filter((event) => event.type === "VIEWED")).toHaveLength(1);
  });

  it("ignores the business's own visits", async () => {
    const { token, invoice, user } = await sentInvoice();

    await publicInvoiceService.recordView(token, user.id);

    const stored = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stored).toMatchObject({ status: "SENT", viewedAt: null });
  });

  it("records the first view without undoing a payment status", async () => {
    const { token, invoice } = await sentInvoice();
    await callRoute(recordPayment, {
      method: "POST",
      params: { id: invoice.id },
      body: { amount: "1000", paymentDate: "2026-09-01", method: "CASH" },
    });

    await publicInvoiceService.recordView(token, null);

    expect(await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ status: "PARTIALLY_PAID" });
  });
});

describe("GET /i/:token/pdf", () => {
  it("downloads the PDF without signing in", async () => {
    const { token, invoice } = await sentInvoice();
    signInAs(null);

    const response = await pdf(token);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${invoice.number}.pdf"`);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);

  it("gives nothing away for dead links and rate limits by IP", async () => {
    const { token, invoice } = await sentInvoice();
    await callRoute(cancel, { method: "POST", params: { id: invoice.id } });

    const dead = await pdf(token);
    expect(dead.status).toBe(404);
    expect(await dead.json()).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Document not found" } });

    for (let i = 0; i < 60; i++) await pdf("inv_0000000000000000000A", "203.0.113.50");
    expect((await pdf("inv_0000000000000000000A", "203.0.113.50")).status).toBe(429);
  });
});
