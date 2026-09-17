import { describe, expect, it } from "vitest";
import { defaultEmailMessage, defaultEmailSubject } from "./email-text";

const invoice = { kind: "invoice", number: "INV-0044", clientName: "Ana Ruiz", businessName: "Alvorada Studio" } as const;

describe("defaultEmailSubject", () => {
  it("names the document and the sender", () => {
    expect(defaultEmailSubject(invoice)).toBe("Invoice INV-0044 from Alvorada Studio");
  });

  it("says estimate for estimates", () => {
    expect(defaultEmailSubject({ ...invoice, kind: "estimate", number: "EST-0014" })).toBe(
      "Estimate EST-0014 from Alvorada Studio",
    );
  });
});

describe("defaultEmailMessage", () => {
  it("greets the client by first name and signs off as the business", () => {
    const message = defaultEmailMessage(invoice);
    expect(message.startsWith("Hi Ana,")).toBe(true);
    expect(message.endsWith("Alvorada Studio")).toBe(true);
  });

  it("leaves out the number, amount and dates, which the template prints", () => {
    const message = defaultEmailMessage(invoice);
    expect(message).not.toContain("INV-0044");
    expect(message).not.toMatch(/\d/);
  });

  it("falls back to a neutral greeting without a usable name", () => {
    expect(defaultEmailMessage({ ...invoice, clientName: null }).startsWith("Hi there,")).toBe(true);
    expect(defaultEmailMessage({ ...invoice, clientName: "  " }).startsWith("Hi there,")).toBe(true);
    // A company name still greets by its first word, which reads better than "Hi there".
    expect(defaultEmailMessage({ ...invoice, clientName: "Pine & Co." }).startsWith("Hi Pine,")).toBe(true);
  });

  it("asks for a reply on estimates and drops the due-date nudge when nothing is owed", () => {
    expect(defaultEmailMessage({ ...invoice, kind: "estimate" })).toContain("let me know if it works for you");
    expect(defaultEmailMessage({ ...invoice, settled: true })).toContain("nothing is owed");
  });
});
