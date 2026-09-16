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
});
