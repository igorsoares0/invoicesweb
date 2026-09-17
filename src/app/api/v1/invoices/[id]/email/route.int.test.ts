import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { db } from "@/server/db";
import { CAPTURE_FAILURE_ADDRESS, capturedEmails } from "@/server/email/transport";
import { PATCH } from "../route";
import { POST as cancel } from "../cancel/route";
import { DELETE as revokeLink } from "../public-link/route";
import { POST as send } from "../send/route";
import { POST as create } from "../../route";
import { POST as email } from "./route";

async function signedInAccount() {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  signInAs(account.user.id);
  const client = await createClientRecord(account.business.id, { name: "Ana Ruiz", email: "billing@pineco.com" });
  return { ...account, client };
}

/** A draft with one line, ready to be sent. */
async function readyDraft(clientId: string) {
  const created = await callRoute(create, { method: "POST", body: { clientId } });
  const { json } = await callRoute(PATCH, {
    method: "PATCH",
    params: { id: created.json.data.id },
    body: { items: [lineInput()] },
  });
  return json.data;
}

const emailBody = (overrides: Record<string, unknown> = {}) => ({
  to: ["billing@pineco.com"],
  attachPdf: false,
  sendCopy: false,
  ...overrides,
});

function sendEmail(id: string, body: Record<string, unknown> = emailBody()) {
  return callRoute(email, { method: "POST", params: { id }, body });
}

describe("POST /api/v1/invoices/:id/email", () => {
  it("sends the draft, then emails it — one history line, not two", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const { status, json } = await sendEmail(draft.id);

    expect(status).toBe(200);
    expect(json.data.invoice).toMatchObject({ status: "SENT", number: draft.number });
    expect(json.data.invoice.publicToken).toMatch(/^inv_[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(json.data.email).toMatchObject({
      status: "SENT",
      type: "INVOICE",
      recipients: ["billing@pineco.com"],
      subject: `Invoice ${draft.number} from Alvorada Studio`,
      attachedPdf: false,
      error: null,
    });

    const events = json.data.invoice.events.map((event: { type: string; metadata: Record<string, unknown> | null }) => [
      event.type,
      event.metadata?.channel ?? null,
    ]);
    expect(events).toEqual([
      ["SENT", "email"],
      ["CREATED", null],
    ]);

    // The owner's payload carries the delivery history; the public one never does.
    expect(json.data.invoice.emails).toEqual([json.data.email]);

    const [message] = capturedEmails();
    expect(message.subject).toBe(`Invoice ${draft.number} from Alvorada Studio`);
    expect(message.from).toBe("Alvorada Studio <onboarding@resend.dev>");
    expect(message.html).toContain(`/i/${json.data.invoice.publicToken}`);
    expect(message.attachments).toBeUndefined();
  });

  it("freezes the snapshot exactly like a manual send", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await sendEmail(draft.id);

    await db.client.update({ where: { id: client.id }, data: { name: "Renamed after sending" } });
    const stored = await db.invoice.findUniqueOrThrow({ where: { id: draft.id } });

    expect((stored.billToSnapshot as { name: string }).name).toBe("Ana Ruiz");
    expect(stored.sentAt).not.toBeNull();
  });

  it("re-sends a sent invoice without touching its status or snapshot", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });
    const afterSend = await db.invoice.findUniqueOrThrow({ where: { id: draft.id } });

    const { status, json } = await sendEmail(draft.id, emailBody({ to: ["ana@pineco.com", "ops@pineco.com"] }));

    expect(status).toBe(200);
    expect(json.data.invoice.status).toBe("SENT");
    const stored = await db.invoice.findUniqueOrThrow({ where: { id: draft.id } });
    expect(stored.publicToken).toBe(afterSend.publicToken);
    expect(stored.sentAt?.toISOString()).toBe(afterSend.sentAt?.toISOString());
    // The manual send already owns the SENT line, so the email gets its own.
    expect(json.data.invoice.events[0]).toMatchObject({ type: "EMAIL_SENT" });
    expect(json.data.invoice.events[0].metadata).toMatchObject({ to: ["ana@pineco.com", "ops@pineco.com"] });
    expect(json.data.email.recipients).toEqual(["ana@pineco.com", "ops@pineco.com"]);
  });

  it("recreates a revoked link, so the email never carries a dead one", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });
    await callRoute(revokeLink, { method: "DELETE", params: { id: draft.id } });

    const { json } = await sendEmail(draft.id);

    expect(json.data.invoice.publicToken).toMatch(/^inv_/);
    expect(capturedEmails()[0].html).toContain(`/i/${json.data.invoice.publicToken}`);
  });

  it("fills the default subject and message when they are left out", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    await sendEmail(draft.id);

    const [message] = capturedEmails();
    expect(message.text).toContain("Hi Ana,");
    expect(message.text).toContain(`Invoice: ${draft.number}`);
    expect(message.text).toContain("Amount: $2,400.00");
  });

  it("uses the subject and message it is given", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    await sendEmail(draft.id, emailBody({ subject: "Your invoice, as promised", message: "Hi Ana,\n\nAs discussed." }));

    const [message] = capturedEmails();
    expect(message.subject).toBe("Your invoice, as promised");
    expect(message.html).toContain("As discussed.");
  });

  it("blind-copies the account address and replies to the business", async () => {
    const { client, business, user } = await signedInAccount();
    await db.business.update({ where: { id: business.id }, data: { email: "hello@alvorada.studio" } });
    const draft = await readyDraft(client.id);

    await sendEmail(draft.id, emailBody({ sendCopy: true }));

    const [message] = capturedEmails();
    expect(message.bcc).toEqual([user.email]);
    expect(message.replyTo).toBe("hello@alvorada.studio");
    expect((await db.emailLog.findFirstOrThrow()).copyToSelf).toBe(true);
  });

  it("records a failure, keeps the invoice sent, and says why", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const { status, json } = await sendEmail(draft.id, emailBody({ to: [CAPTURE_FAILURE_ADDRESS] }));

    // The send already committed, so this is a result, not an error.
    expect(status).toBe(200);
    expect(json.data.invoice.status).toBe("SENT");
    expect(json.data.email).toMatchObject({ status: "FAILED", error: "the address was rejected" });
    expect(json.data.invoice.events.map((event: { type: string }) => event.type)).toEqual([
      "EMAIL_FAILED",
      "SENT",
      "CREATED",
    ]);
    expect(json.data.invoice.events[0].metadata).toMatchObject({ reason: "the address was rejected" });
  });

  it("refuses a draft that isn't ready, and sends nothing", async () => {
    const { client } = await signedInAccount();
    const created = await callRoute(create, { method: "POST", body: { clientId: client.id } });

    const { status, json } = await sendEmail(created.json.data.id);

    expect(status).toBe(422);
    expect(Object.keys(json.error.details)).toEqual(["items"]);
    expect(capturedEmails()).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: created.json.data.id } })).status).toBe("DRAFT");
  });

  it("refuses a cancelled invoice", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });
    await callRoute(cancel, { method: "POST", params: { id: draft.id } });

    const { status, json } = await sendEmail(draft.id);

    expect(status).toBe(409);
    expect(json.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(await db.emailLog.count()).toBe(0);
  });

  it("validates the recipient list", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const empty = await sendEmail(draft.id, emailBody({ to: [] }));
    expect(empty.status).toBe(422);
    expect(empty.json.error.details.to[0]).toBe("Add at least one recipient");

    const invalid = await sendEmail(draft.id, emailBody({ to: ["not-an-email"] }));
    expect(invalid.status).toBe(422);

    const duplicated = await sendEmail(draft.id, emailBody({ to: ["a@b.com", "a@b.com"] }));
    expect(duplicated.json.error.details.to[0]).toBe("That address is already on the list");

    const tooMany = await sendEmail(draft.id, emailBody({ to: ["a@b.com", "c@b.com", "d@b.com", "e@b.com", "f@b.com", "g@b.com"] }));
    expect(tooMany.status).toBe(422);
    expect(capturedEmails()).toHaveLength(0);
  });

  it("hides another business's invoice", async () => {
    const other = await signedInAccount();
    const draft = await readyDraft(other.client.id);
    const mine = await signedInAccount();
    expect(mine.business.id).not.toBe(other.business.id);

    const { status } = await sendEmail(draft.id);

    expect(status).toBe(404);
  });

  it("stops a runaway loop with the email rate limit", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await sendEmail(draft.id)).status).toBe(200);
    }
    const blocked = await sendEmail(draft.id);

    expect(blocked.status).toBe(429);
    expect(blocked.json.error.code).toBe("RATE_LIMITED");
  });

  it("gives every attempt its own idempotency key", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    await sendEmail(draft.id);
    await sendEmail(draft.id);

    const [first, second] = capturedEmails();
    const logs = await db.emailLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    expect([first.idempotencyKey, second.idempotencyKey]).toEqual(logs.map((log) => `invoice-email/${log.id}`));
  });

  it("attaches the PDF under the invoice number", { timeout: 60_000 }, async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const { json } = await sendEmail(draft.id, emailBody({ attachPdf: true }));

    expect(json.data.email.attachedPdf).toBe(true);
    const [message] = capturedEmails();
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments![0].filename).toBe(`${draft.number}.pdf`);
    expect(message.attachments![0].content.subarray(0, 4).toString()).toBe("%PDF");
  });
});
