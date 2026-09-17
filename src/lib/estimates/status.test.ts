import { describe, expect, it } from "vitest";
import { canPerformEstimate, displayEstimateStatus, isExpired } from "./status";

const sent = { status: "SENT" as const, expiryDate: "2026-09-22", convertedInvoiceId: null };

describe("displayEstimateStatus", () => {
  it("expires the day after the expiry date while awaiting a reply", () => {
    expect(displayEstimateStatus(sent, "2026-09-22")).toBe("SENT");
    expect(displayEstimateStatus(sent, "2026-09-23")).toBe("EXPIRED");
    expect(displayEstimateStatus({ ...sent, status: "VIEWED" }, "2026-09-23")).toBe("EXPIRED");
  });

  it("never expires drafts or answered estimates", () => {
    for (const status of ["DRAFT", "ACCEPTED", "DECLINED", "CONVERTED"] as const) {
      expect(displayEstimateStatus({ ...sent, status }, "2027-01-01")).toBe(status);
    }
    expect(isExpired({ ...sent, status: "ACCEPTED" }, "2027-01-01")).toBe(false);
  });
});

describe("canPerformEstimate", () => {
  const today = "2026-09-15";

  it("locks everything but drafts for editing, deleting and sending", () => {
    expect(canPerformEstimate({ ...sent, status: "DRAFT" }, "edit", today)).toBe(true);
    for (const action of ["edit", "delete", "send"] as const) {
      expect(canPerformEstimate(sent, action, today)).toBe(false);
    }
  });

  it("accepts and declines only while awaiting a reply and not expired", () => {
    expect(canPerformEstimate(sent, "accept", today)).toBe(true);
    expect(canPerformEstimate({ ...sent, status: "VIEWED" }, "decline", today)).toBe(true);
    expect(canPerformEstimate(sent, "accept", "2026-09-23")).toBe(false);
    expect(canPerformEstimate({ ...sent, status: "ACCEPTED" }, "decline", today)).toBe(false);
    expect(canPerformEstimate({ ...sent, status: "DRAFT" }, "accept", today)).toBe(false);
  });

  it("converts accepted estimates, or converted ones whose invoice was deleted", () => {
    expect(canPerformEstimate({ ...sent, status: "ACCEPTED" }, "convert", today)).toBe(true);
    expect(canPerformEstimate(sent, "convert", today)).toBe(false);
    expect(canPerformEstimate({ ...sent, status: "CONVERTED", convertedInvoiceId: "inv1" }, "convert", today)).toBe(false);
    expect(canPerformEstimate({ ...sent, status: "CONVERTED", convertedInvoiceId: null }, "convert", today)).toBe(true);
  });

  it("reopens a declined estimate that is still valid", () => {
    expect(canPerformEstimate({ ...sent, status: "DECLINED" }, "reopen", today)).toBe(true);
    expect(canPerformEstimate({ ...sent, status: "DECLINED" }, "reopen", "2026-10-01")).toBe(false);
    expect(canPerformEstimate(sent, "reopen", today)).toBe(false);
  });

  it("allows email until the estimate expires or becomes an invoice", () => {
    for (const status of ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED"] as const) {
      expect(canPerformEstimate({ ...sent, status }, "email", today)).toBe(true);
    }
    // Awaiting a reply past the expiry date: the client has nothing left to answer.
    expect(canPerformEstimate(sent, "email", "2026-10-01")).toBe(false);
    // Accepted stays emailable even after the expiry date — the answer is already in.
    expect(canPerformEstimate({ ...sent, status: "ACCEPTED" }, "email", "2026-10-01")).toBe(true);
    expect(canPerformEstimate({ ...sent, status: "CONVERTED", convertedInvoiceId: "inv1" }, "email", today)).toBe(false);
  });
});
