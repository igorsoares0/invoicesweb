import { describe, expect, it } from "vitest";
import { describeEstimateEvent } from "./events";

describe("describeEstimateEvent", () => {
  it("says who recorded the reply", () => {
    expect(describeEstimateEvent({ type: "ACCEPTED", metadata: { by: "client" } }).label).toBe("Accepted by client");
    expect(describeEstimateEvent({ type: "ACCEPTED", metadata: { by: "you" } }).label).toBe("Marked accepted by you");
    expect(describeEstimateEvent({ type: "DECLINED", metadata: { by: "you" } })).toEqual({
      label: "Marked declined by you",
      tone: "danger",
    });
  });

  it("reads a sent event by its channel", () => {
    expect(describeEstimateEvent({ type: "SENT", metadata: { channel: "manual" } }).label).toBe("Marked as sent");
    expect(describeEstimateEvent({ type: "SENT", metadata: { channel: "email", to: ["ana@pineco.com"] } }).label).toBe(
      "Emailed to ana@pineco.com",
    );
    expect(describeEstimateEvent({ type: "EMAIL_FAILED", metadata: { reason: "the address was rejected" } })).toEqual({
      label: "Email failed — the address was rejected",
      tone: "danger",
    });
  });

  it("links the conversion to its invoice number", () => {
    expect(describeEstimateEvent({ type: "CONVERTED", metadata: { invoiceNumber: "INV-0045" } }).label).toBe(
      "Converted to INV-0045",
    );
  });
});
