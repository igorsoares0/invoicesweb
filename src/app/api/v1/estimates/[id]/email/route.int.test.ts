import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { db } from "@/server/db";
import { CAPTURE_FAILURE_ADDRESS, capturedEmails } from "@/server/email/transport";
import { POST as accept } from "../accept/route";
import { POST as convert } from "../convert/route";
import { PATCH } from "../route";
import { POST as send } from "../send/route";
import { POST as create } from "../../route";
import { POST as email } from "./route";

async function signedInAccount() {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  signInAs(account.user.id);
  const client = await createClientRecord(account.business.id, { name: "Ana Ruiz", email: "billing@pineco.com" });
  return { ...account, client };
}

async function readyDraft(clientId: string) {
  const created = await callRoute(create, { method: "POST", body: { clientId } });
  const { json } = await callRoute(PATCH, {
    method: "PATCH",
    params: { id: created.json.data.id },
    body: { items: [lineInput({ unitPrice: "4260" })] },
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

describe("POST /api/v1/estimates/:id/email", () => {
  it("sends the draft and emails it, talking about accepting or declining", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const { status, json } = await sendEmail(draft.id);

    expect(status).toBe(200);
    expect(json.data.estimate).toMatchObject({ status: "SENT", number: draft.number });
    expect(json.data.email).toMatchObject({
      status: "SENT",
      type: "ESTIMATE",
      subject: `Estimate ${draft.number} from Alvorada Studio`,
    });
    expect(json.data.estimate.events.map((event: { type: string }) => event.type)).toEqual(["SENT", "CREATED"]);

    const [message] = capturedEmails();
    expect(message.html).toContain(`/e/${json.data.estimate.publicToken}`);
    expect(message.html).toContain("accept or decline");
    expect(message.html).toContain("Valid until");
  });

  it("re-sends an accepted estimate, which keeps its answer", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });
    await callRoute(accept, { method: "POST", params: { id: draft.id } });

    const { status, json } = await sendEmail(draft.id);

    expect(status).toBe(200);
    expect(json.data.estimate.status).toBe("ACCEPTED");
    expect(json.data.estimate.events[0]).toMatchObject({ type: "EMAIL_SENT" });
  });

  it("refuses an expired estimate — the client has nothing left to answer", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });
    await db.estimate.update({ where: { id: draft.id }, data: { expiryDate: new Date("2020-01-01") } });

    const { status, json } = await sendEmail(draft.id);

    expect(status).toBe(409);
    expect(json.error.message).toContain("expired");
    expect(await db.emailLog.count()).toBe(0);
  });

  it("refuses a converted estimate and points at the invoice", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);
    await callRoute(send, { method: "POST", params: { id: draft.id } });
    await callRoute(accept, { method: "POST", params: { id: draft.id } });
    const converted = await callRoute(convert, {
      method: "POST",
      params: { id: draft.id },
      body: { issueDate: "2026-09-17", dueDate: "2026-10-01" },
    });
    expect(converted.status).toBe(201);

    const { status, json } = await sendEmail(draft.id);

    expect(status).toBe(409);
    expect(json.error.message).toContain("invoice");
  });

  it("records a failure without changing the estimate", async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    const { status, json } = await sendEmail(draft.id, emailBody({ to: [CAPTURE_FAILURE_ADDRESS] }));

    expect(status).toBe(200);
    expect(json.data.estimate.status).toBe("SENT");
    expect(json.data.email.status).toBe("FAILED");
    expect(json.data.estimate.events[0]).toMatchObject({ type: "EMAIL_FAILED" });
  });

  it("hides another business's estimate", async () => {
    const other = await signedInAccount();
    const draft = await readyDraft(other.client.id);
    await signedInAccount();

    expect((await sendEmail(draft.id)).status).toBe(404);
  });

  it("attaches the PDF under the estimate number", { timeout: 60_000 }, async () => {
    const { client } = await signedInAccount();
    const draft = await readyDraft(client.id);

    await sendEmail(draft.id, emailBody({ attachPdf: true }));

    const [message] = capturedEmails();
    expect(message.attachments![0].filename).toBe(`${draft.number}.pdf`);
    expect(message.attachments![0].content.subarray(0, 4).toString()).toBe("%PDF");
  });
});
