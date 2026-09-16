import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { DELETE as revokeLink } from "@/app/api/v1/estimates/[id]/public-link/route";
import { PATCH } from "@/app/api/v1/estimates/[id]/route";
import { POST as send } from "@/app/api/v1/estimates/[id]/send/route";
import { POST as create } from "@/app/api/v1/estimates/route";
import { POST as acceptRoute } from "@/app/e/[token]/accept/route";
import { POST as declineRoute } from "@/app/e/[token]/decline/route";
import { GET as pdfRoute } from "@/app/e/[token]/pdf/route";
import { db } from "@/server/db";
import { publicEstimateService } from "./public-estimate-service";

async function sentEstimate() {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  signInAs(account.user.id);
  await db.business.update({ where: { id: account.business.id }, data: { email: "hello@alvorada.studio", paymentInstructions: "IBAN PT50" } });
  const client = await createClientRecord(account.business.id, { name: "Pine & Co.", email: "billing@pineco.com" });
  const draft = (await callRoute(create, { method: "POST", body: { clientId: client.id } })).json.data;
  await callRoute(PATCH, { method: "PATCH", params: { id: draft.id }, body: { items: [lineInput({ unitPrice: "6996" })] } });
  const estimate = (await callRoute(send, { method: "POST", params: { id: draft.id } })).json.data;
  signInAs(null);
  return { ...account, estimate, token: estimate.publicToken as string };
}

const reply = (handler: typeof acceptRoute | typeof declineRoute, token: string, ip = "198.51.100.7") =>
  callRoute(handler as never, { method: "POST", params: { token } as never, headers: { "x-forwarded-for": ip } });

describe("publicEstimateService.find", () => {
  it("shows the estimate with estimate wording and no payment details", async () => {
    const { token, estimate } = await sentEstimate();

    const found = await publicEstimateService.find(token);

    expect(found).toMatchObject({ number: estimate.number, state: "awaiting", issuerName: "Alvorada Studio" });
    expect(found?.stateLabel).toMatch(/^Expires in \d+ days$/);
    expect(found?.view.labels.title).toBe("Estimate");
    expect(found?.view.paymentInstructions).toBeNull();
    expect(JSON.stringify(found)).not.toContain(estimate.id);
  });

  it("treats malformed, unknown, revoked and invoice tokens as missing", async () => {
    const { token, estimate, user } = await sentEstimate();
    expect(await publicEstimateService.find("inv_0000000000000000000A")).toBeNull();
    expect(await publicEstimateService.find("est_0000000000000000000A")).toBeNull();

    signInAs(user.id);
    await callRoute(revokeLink, { method: "DELETE", params: { id: estimate.id } });
    expect(await publicEstimateService.find(token)).toBeNull();
  });
});

describe("public replies", () => {
  it("lets the client accept without an account, once", async () => {
    const { token, estimate } = await sentEstimate();

    const first = await reply(acceptRoute, token);
    expect(first.status).toBe(200);
    expect(first.json.data.state).toBe("accepted");

    const again = await reply(acceptRoute, token);
    expect(again.status).toBe(200);

    const stored = await db.estimate.findUniqueOrThrow({ where: { id: estimate.id }, include: { events: true } });
    expect(stored).toMatchObject({ status: "ACCEPTED", respondedBy: "client" });
    expect(stored.events.filter((event) => event.type === "ACCEPTED")).toHaveLength(1);

    const flip = await reply(declineRoute, token);
    expect(flip.status).toBe(409);
    expect(flip.json.error.message).toBe("This estimate was already accepted.");
  });

  it("records a decline and explains why a later accept is refused", async () => {
    const { token } = await sentEstimate();

    expect((await reply(declineRoute, token)).json.data.state).toBe("declined");
    const late = await reply(acceptRoute, token);
    expect(late.status).toBe(409);
    expect(late.json.error.message).toBe("This estimate was declined. Ask the sender for a new one.");
  });

  it("refuses expired estimates and unknown links", async () => {
    const { token, estimate } = await sentEstimate();
    await db.estimate.update({ where: { id: estimate.id }, data: { expiryDate: new Date("2026-01-01T00:00:00Z") } });

    expect((await publicEstimateService.find(token))?.state).toBe("expired");
    const refused = await reply(acceptRoute, token);
    expect(refused.status).toBe(409);
    expect(refused.json.error.message).toBe("This estimate has expired and can no longer be answered.");

    const unknown = await reply(acceptRoute, "est_0000000000000000000A");
    expect(unknown.status).toBe(404);
  });

  it("rate limits replies per IP", async () => {
    for (let i = 0; i < 60; i++) await reply(acceptRoute, "est_0000000000000000000A", "203.0.113.77");
    expect((await reply(acceptRoute, "est_0000000000000000000A", "203.0.113.77")).status).toBe(429);
  });
});

describe("publicEstimateService.recordView", () => {
  it("marks viewed once and ignores the owner", async () => {
    const { token, estimate, user } = await sentEstimate();

    await publicEstimateService.recordView(token, user.id);
    expect((await db.estimate.findUniqueOrThrow({ where: { id: estimate.id } })).status).toBe("SENT");

    await Promise.all([publicEstimateService.recordView(token, null), publicEstimateService.recordView(token, null)]);
    const stored = await db.estimate.findUniqueOrThrow({ where: { id: estimate.id }, include: { events: true } });
    expect(stored.status).toBe("VIEWED");
    expect(stored.events.filter((event) => event.type === "VIEWED")).toHaveLength(1);
  });
});

describe("GET /e/:token/pdf", () => {
  it("downloads the estimate PDF", async () => {
    const { token, estimate } = await sentEstimate();

    const response = await pdfRoute(new Request(`http://localhost/e/${token}/pdf`), { params: Promise.resolve({ token }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${estimate.number}.pdf"`);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);
});
