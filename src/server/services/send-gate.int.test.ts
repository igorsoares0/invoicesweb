import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput, type TestPlan } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { POST as acceptEstimate } from "@/app/api/v1/estimates/[id]/accept/route";
import { POST as convertEstimate } from "@/app/api/v1/estimates/[id]/convert/route";
import { POST as emailEstimate } from "@/app/api/v1/estimates/[id]/email/route";
import { PATCH as patchEstimate } from "@/app/api/v1/estimates/[id]/route";
import { POST as sendEstimate } from "@/app/api/v1/estimates/[id]/send/route";
import { POST as createEstimate } from "@/app/api/v1/estimates/route";
import { POST as emailInvoice } from "@/app/api/v1/invoices/[id]/email/route";
import { PATCH as patchInvoice } from "@/app/api/v1/invoices/[id]/route";
import { POST as sendInvoice } from "@/app/api/v1/invoices/[id]/send/route";
import { POST as createInvoice } from "@/app/api/v1/invoices/route";
import { db } from "@/server/db";
import { capturedEmails } from "@/server/email/transport";

async function account(plan: TestPlan) {
  const created = await createAccount({ businessName: "Alvorada Studio", plan });
  signInAs(created.user.id);
  const client = await createClientRecord(created.business.id, { name: "Ana Ruiz", email: "billing@pineco.com" });
  return { ...created, client };
}

async function draftInvoice(clientId: string, extra: Record<string, unknown> = {}) {
  const created = await callRoute(createInvoice, { method: "POST", body: { clientId } });
  const { json } = await callRoute(patchInvoice, {
    method: "PATCH",
    params: { id: created.json.data.id },
    body: { items: [lineInput()], ...extra },
  });
  return json.data;
}

async function draftEstimate(clientId: string, extra: Record<string, unknown> = {}) {
  const created = await callRoute(createEstimate, { method: "POST", body: { clientId } });
  const { json } = await callRoute(patchEstimate, {
    method: "PATCH",
    params: { id: created.json.data.id },
    body: { items: [lineInput()], ...extra },
  });
  return json.data;
}

const send = (id: string) => callRoute(sendInvoice, { method: "POST", params: { id } });

/** Invoices already sent this month, stamped straight in the database. */
async function alreadySent(businessId: string, count: number, when = new Date()) {
  for (let i = 0; i < count; i += 1) {
    const sequence = 1000 + (await db.invoice.count({ where: { businessId } }));
    await db.invoice.create({
      data: {
        businessId,
        sequence,
        number: `INV-${sequence}`,
        status: "SENT",
        issueDate: new Date(),
        dueDate: new Date(),
        currency: "USD",
        sentAt: when,
      },
    });
  }
}

describe("the monthly send limit on Free", () => {
  it("lets three invoices out, then refuses the fourth and keeps it a draft", async () => {
    const { client } = await account("FREE");
    const drafts = [];
    for (let i = 0; i < 4; i += 1) drafts.push(await draftInvoice(client.id));

    for (const draft of drafts.slice(0, 3)) expect((await send(draft.id)).status).toBe(200);
    const refused = await send(drafts[3].id);

    expect(refused.status).toBe(402);
    expect(refused.json.error.code).toBe("PLAN_LIMIT_REACHED");
    expect(refused.json.error.message).toMatch(/all 3 invoices/);
    const stored = await db.invoice.findUniqueOrThrow({ where: { id: drafts[3].id } });
    expect(stored).toMatchObject({ status: "DRAFT", publicToken: null, sentAt: null });
  });

  it("refuses an emailed draft the same way, before any email is logged", async () => {
    const { client, business } = await account("FREE");
    await alreadySent(business.id, 3);
    const draft = await draftInvoice(client.id);

    const { status, json } = await callRoute(emailInvoice, {
      method: "POST",
      params: { id: draft.id },
      body: { to: ["billing@pineco.com"], attachPdf: false, sendCopy: false },
    });

    expect(status).toBe(402);
    expect(json.error.code).toBe("PLAN_LIMIT_REACHED");
    expect(await db.emailLog.count()).toBe(0);
    expect(capturedEmails()).toHaveLength(0);
  });

  it("doesn't count re-sending an invoice that already went out", async () => {
    const { client, business } = await account("FREE");
    const draft = await draftInvoice(client.id);
    await send(draft.id);
    await alreadySent(business.id, 2);

    const { status } = await callRoute(emailInvoice, {
      method: "POST",
      params: { id: draft.id },
      body: { to: ["billing@pineco.com"], attachPdf: false, sendCopy: false },
    });

    expect(status).toBe(200);
  });

  it("starts over with the new month", async () => {
    const { client, business } = await account("FREE");
    await alreadySent(business.id, 3, new Date(Date.now() - 40 * 86_400_000));
    const draft = await draftInvoice(client.id);

    expect((await send(draft.id)).status).toBe(200);
  });

  it("lets only one of two simultaneous sends take the last slot", async () => {
    const { client, business } = await account("FREE");
    await alreadySent(business.id, 2);
    const first = await draftInvoice(client.id);
    const second = await draftInvoice(client.id);

    const results = await Promise.all([send(first.id), send(second.id)]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 402]);
    expect(await db.invoice.count({ where: { businessId: business.id, sentAt: { not: null } } })).toBe(3);
  });

  it("puts no limit on the trial or on Pro", async () => {
    for (const plan of ["TRIAL", "PRO"] as const) {
      const { client, business } = await account(plan);
      await alreadySent(business.id, 5);
      const draft = await draftInvoice(client.id);
      expect((await send(draft.id)).status).toBe(200);
    }
  });
});

describe("Pro options on Free", () => {
  it("refuses a Pro template and says so field by field", async () => {
    const { client } = await account("FREE");
    const draft = await draftInvoice(client.id, { template: "BOLD" });

    const { status, json } = await send(draft.id);

    expect(status).toBe(402);
    expect(json.error.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(Object.keys(json.error.details)).toEqual(["template"]);
  });

  it("refuses a custom accent colour only where the template paints with it", async () => {
    const { client } = await account("FREE");
    const modern = await draftInvoice(client.id, { color: "#15803d" });
    const classic = await draftInvoice(client.id, { template: "CLASSIC", color: "#15803d" });

    const refused = await send(modern.id);
    expect(refused.status).toBe(402);
    expect(Object.keys(refused.json.error.details)).toEqual(["color"]);
    expect((await send(classic.id)).status).toBe(200);
  });

  it("allows everything during the trial", async () => {
    const { client } = await account("TRIAL");
    const draft = await draftInvoice(client.id, { template: "PROFESSIONAL", color: "#7c3aed" });
    expect((await send(draft.id)).status).toBe(200);
  });
});

describe("estimates on Free", () => {
  it("are never limited, even with the invoice quota used up", async () => {
    const { client, business } = await account("FREE");
    await alreadySent(business.id, 3);
    for (let i = 0; i < 4; i += 1) {
      const estimate = await draftEstimate(client.id);
      expect((await callRoute(sendEstimate, { method: "POST", params: { id: estimate.id } })).status).toBe(200);
    }
  });

  it("still need Pro for Pro options, by mark-as-sent or by email", async () => {
    const { client } = await account("FREE");
    const marked = await draftEstimate(client.id, { template: "BOLD" });
    const emailed = await draftEstimate(client.id, { template: "BOLD" });

    expect((await callRoute(sendEstimate, { method: "POST", params: { id: marked.id } })).status).toBe(402);
    const viaEmail = await callRoute(emailEstimate, {
      method: "POST",
      params: { id: emailed.id },
      body: { to: ["billing@pineco.com"], attachPdf: false, sendCopy: false },
    });
    expect(viaEmail.status).toBe(402);
    expect(viaEmail.json.error.code).toBe("SUBSCRIPTION_REQUIRED");
  });
});

describe("converting an estimate and sending the invoice", () => {
  const dates = { issueDate: "2026-09-18", dueDate: "2026-10-02" };

  async function acceptedEstimate(clientId: string, extra: Record<string, unknown> = {}) {
    const estimate = await draftEstimate(clientId, extra);
    await callRoute(sendEstimate, { method: "POST", params: { id: estimate.id } });
    await callRoute(acceptEstimate, { method: "POST", params: { id: estimate.id } });
    return estimate;
  }

  it("converts nothing when the plan refuses the send", async () => {
    const { client, business } = await account("FREE");
    await alreadySent(business.id, 3);
    const estimate = await acceptedEstimate(client.id);
    const invoicesBefore = await db.invoice.count({ where: { businessId: business.id } });

    const { status, json } = await callRoute(convertEstimate, {
      method: "POST",
      params: { id: estimate.id },
      body: { ...dates, send: true },
    });

    expect(status).toBe(402);
    expect(json.error.code).toBe("PLAN_LIMIT_REACHED");
    expect((await db.estimate.findUniqueOrThrow({ where: { id: estimate.id } })).status).toBe("ACCEPTED");
    expect(await db.invoice.count({ where: { businessId: business.id } })).toBe(invoicesBefore);
  });

  it("refuses an estimate built with a Pro template during the trial, once the trial is over", async () => {
    const { client, user, business } = await account("TRIAL");
    const estimate = await acceptedEstimate(client.id, { template: "BOLD" });
    await db.user.update({ where: { id: user.id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });

    const { status, json } = await callRoute(convertEstimate, {
      method: "POST",
      params: { id: estimate.id },
      body: { ...dates, send: true },
    });

    expect(status).toBe(402);
    expect(json.error.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(await db.invoice.count({ where: { businessId: business.id } })).toBe(0);
  });

  it("still converts without sending when the quota is used up", async () => {
    const { client, business } = await account("FREE");
    await alreadySent(business.id, 3);
    const estimate = await acceptedEstimate(client.id);

    const { status, json } = await callRoute(convertEstimate, {
      method: "POST",
      params: { id: estimate.id },
      body: { ...dates, send: false },
    });

    expect(status).toBe(201);
    expect(json.data.invoice.status).toBe("DRAFT");
  });
});

describe("the Made with mark", () => {
  it("is frozen into what Free sends, and left off what the trial sends", async () => {
    const free = await account("FREE");
    const freeDraft = await draftInvoice(free.client.id);
    await send(freeDraft.id);
    const trial = await account("TRIAL");
    const trialDraft = await draftInvoice(trial.client.id);
    await send(trialDraft.id);

    const branded = async (id: string) =>
      ((await db.invoice.findUniqueOrThrow({ where: { id } })).issuerSnapshot as { branded?: boolean }).branded;
    expect(await branded(freeDraft.id)).toBe(true);
    expect(await branded(trialDraft.id)).toBe(false);
  });
});
