import { describe, expect, it } from "vitest";
import { buildDocumentEmail, type DocumentEmailInput } from "./message";

const invoice: DocumentEmailInput = {
  kind: "invoice",
  number: "INV-0044",
  total: "6996.00",
  currency: "USD",
  endDate: "2026-09-26",
  businessName: "Alvorada Studio",
  businessEmail: "hello@alvorada.studio",
  publicUrl: "https://app.example.com/i/inv_4K92MX7QF3ABCDEFGHJK",
  message: "Hi Ana,\n\nHere's the invoice for the work. Let me know if anything looks off.\n\nThanks,\nAlvorada Studio",
  accentColor: "#1e40af",
  paymentInstructions: "Bank: Alvorada Studio\nIBAN: PT50 0002 0123 1234 5678 9015 4",
};

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("buildDocumentEmail", () => {
  it("prints the number, amount and due date once each, next to the view button", async () => {
    const { html } = await buildDocumentEmail(invoice);
    expect(occurrences(html, "INV-0044")).toBe(2); // the <title> and the facts row
    expect(occurrences(html, "$6,996.00")).toBe(1);
    expect(occurrences(html, "September 26, 2026")).toBe(1);
    expect(html).toContain(">View invoice<");
    expect(html).toContain(invoice.publicUrl);
  });

  it("uses the document's accent colour for the button", async () => {
    const { html } = await buildDocumentEmail({ ...invoice, accentColor: "#b45309" });
    expect(html).toContain("background-color:#b45309");
  });

  it("keeps the user's paragraphs and escapes anything HTML-ish in them", async () => {
    const { html } = await buildDocumentEmail({ ...invoice, message: "First <b>line</b>\n\nSecond paragraph" });
    expect(html).toContain("First &lt;b&gt;line&lt;/b&gt;");
    expect(html).toContain("Second paragraph");
    expect(html).not.toContain("<b>line</b>");
  });

  it("carries no stylesheet or embedded font, so clients don't clip the message", async () => {
    const { html } = await buildDocumentEmail(invoice);
    expect(html).not.toContain("<style");
    expect(html).not.toContain("@font-face");
    expect(html.length).toBeLessThan(20_000);
  });

  it("speaks about replying and hides payment instructions on estimates", async () => {
    const { html, text } = await buildDocumentEmail({
      ...invoice,
      kind: "estimate",
      number: "EST-0014",
      endDate: "2026-10-01",
      publicUrl: "https://app.example.com/e/est_4K92MX7QF3ABCDEFGHJK",
    });
    expect(html).toContain("accept or decline");
    expect(html).toContain("Valid until");
    expect(html).not.toContain("How to pay");
    expect(text).not.toContain("IBAN");
  });

  it("builds a plain-text alternative with the same facts and the link", async () => {
    const { text } = await buildDocumentEmail(invoice);
    expect(text).toContain("Invoice: INV-0044");
    expect(text).toContain("Amount: $6,996.00");
    expect(text).toContain("Due: September 26, 2026");
    expect(text).toContain(invoice.publicUrl);
    expect(text).toContain("IBAN: PT50 0002 0123 1234 5678 9015 4");
    expect(text).not.toContain("<");
  });
});
