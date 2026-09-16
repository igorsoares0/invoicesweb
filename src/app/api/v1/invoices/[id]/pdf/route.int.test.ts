import { describe, expect, it } from "vitest";
import { signInAs } from "@tests/setup/auth-state";
import { createAccount, createClientRecord, lineInput } from "@tests/setup/db";
import { callRoute } from "@tests/setup/http";
import { PATCH } from "../route";
import { POST as send } from "../send/route";
import { POST as create } from "../../route";
import { GET, POST } from "./route";

async function rawCall(handler: typeof GET, id: string, query = "") {
  const response = await handler(new Request(`http://localhost/api/v1/invoices/${id}/pdf${query}`), {
    params: Promise.resolve({ id }),
  });
  return response;
}

async function readyInvoice() {
  const account = await createAccount({ businessName: "Alvorada Studio" });
  signInAs(account.user.id);
  const client = await createClientRecord(account.business.id, { name: "Pine & Co." });
  const draft = (await callRoute(create, { method: "POST", body: { clientId: client.id } })).json.data;
  await callRoute(PATCH, {
    method: "PATCH",
    params: { id: draft.id },
    body: { template: "BOLD", items: [lineInput({ description: "Sinalização — São Paulo", unitPrice: "2480" })] },
  });
  return { ...account, invoice: draft };
}

describe("/api/v1/invoices/:id/pdf", () => {
  it("renders a PDF for a ready draft, inline by default", async () => {
    const { invoice } = await readyInvoice();

    const response = await rawCall(GET, invoice.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(`inline; filename="${invoice.number}.pdf"`);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5_000);
  }, 60_000);

  it("offers an attachment download and accepts POST as in the spec", async () => {
    const { invoice } = await readyInvoice();
    await callRoute(send, { method: "POST", params: { id: invoice.id } });

    const download = await rawCall(POST, invoice.id, "?download=1");

    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toMatch(/^attachment;/);
  }, 60_000);

  it("refuses drafts that aren't ready, with the same details as send", async () => {
    const account = await createAccount();
    signInAs(account.user.id);
    const draft = (await callRoute(create, { method: "POST" })).json.data;

    const response = await callRoute(GET, { params: { id: draft.id } });

    expect(response.status).toBe(422);
    expect(Object.keys(response.json.error.details)).toEqual(["clientId", "items"]);
  });

  it("returns 404 for another business's invoice", async () => {
    const { invoice } = await readyInvoice();
    const intruder = await createAccount();
    signInAs(intruder.user.id);

    expect((await callRoute(GET, { params: { id: invoice.id } })).status).toBe(404);
  });
});
