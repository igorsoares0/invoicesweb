import { describe, expect, it } from "vitest";
import { describeEvent } from "./events";

const event = (type: string, metadata: Record<string, unknown> | null = null) =>
  ({ id: "e", type, metadata, createdAt: "2026-08-28T09:14:00.000Z" }) as Parameters<typeof describeEvent>[0];

describe("describeEvent", () => {
  it("labels history entries like the design", () => {
    expect(describeEvent(event("PAYMENT_ADDED", { amount: "2000.00", method: "BANK_TRANSFER" }), "USD")).toEqual({
      label: "Payment added — $2,000.00",
      tone: "success",
    });
    expect(describeEvent(event("VIEWED"), "USD").label).toBe("Viewed by client");
    expect(describeEvent(event("CREATED"), "USD").label).toBe("Created — number assigned");
    expect(describeEvent(event("DUPLICATED", { fromNumber: "INV-0040" }), "USD").label).toBe("Duplicated from INV-0040");
  });

  it("reads a sent event by its channel, so one action is one line", () => {
    expect(describeEvent(event("SENT", { channel: "manual" }), "USD").label).toBe("Marked as sent");
    expect(describeEvent(event("SENT", { channel: "email", to: ["billing@pineco.com"] }), "USD").label).toBe(
      "Emailed to billing@pineco.com",
    );
  });

  it("summarises extra recipients", () => {
    const sent = event("EMAIL_SENT", { to: ["billing@pineco.com", "ana@pineco.com", "ops@pineco.com"] });
    expect(describeEvent(sent, "USD").label).toBe("Emailed to billing@pineco.com +2");
  });

  it("shows why an email failed, in danger tone", () => {
    expect(describeEvent(event("EMAIL_FAILED", { reason: "the address was rejected" }), "USD")).toEqual({
      label: "Email failed — the address was rejected",
      tone: "danger",
    });
    expect(describeEvent(event("EMAIL_FAILED"), "USD").label).toBe("Email failed");
  });
});
