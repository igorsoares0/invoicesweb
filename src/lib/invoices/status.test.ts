import { describe, expect, it } from "vitest";
import { canPerform, displayStatus, statusAfterPayment } from "./status";

describe("displayStatus", () => {
  const base = { status: "SENT" as const, dueDate: "2026-09-15", amountDue: "100.00" };

  it("is overdue from the day after the due date while money is owed", () => {
    expect(displayStatus(base, "2026-09-15")).toBe("SENT");
    expect(displayStatus(base, "2026-09-16")).toBe("OVERDUE");
    expect(displayStatus({ ...base, status: "PARTIALLY_PAID" }, "2026-09-16")).toBe("OVERDUE");
    expect(displayStatus({ ...base, status: "VIEWED" }, "2026-09-16")).toBe("OVERDUE");
  });

  it("never marks drafts, paid, cancelled or settled invoices as overdue", () => {
    expect(displayStatus({ ...base, status: "DRAFT" }, "2026-10-01")).toBe("DRAFT");
    expect(displayStatus({ ...base, status: "PAID", amountDue: "0.00" }, "2026-10-01")).toBe("PAID");
    expect(displayStatus({ ...base, status: "CANCELLED" }, "2026-10-01")).toBe("CANCELLED");
    expect(displayStatus({ ...base, amountDue: "0.00" }, "2026-10-01")).toBe("SENT");
  });
});

describe("canPerform", () => {
  it("only lets drafts be edited, deleted or sent", () => {
    expect(canPerform("DRAFT", "edit")).toBe(true);
    expect(canPerform("SENT", "edit")).toBe(false);
    expect(canPerform("PAID", "delete")).toBe(false);
    expect(canPerform("SENT", "send")).toBe(false);
  });

  it("accepts payments only on open invoices", () => {
    expect(canPerform("DRAFT", "recordPayment")).toBe(false);
    expect(canPerform("VIEWED", "recordPayment")).toBe(true);
    expect(canPerform("PAID", "recordPayment")).toBe(false);
    expect(canPerform("CANCELLED", "recordPayment")).toBe(false);
  });

  it("follows the spec's cancel transitions", () => {
    expect(canPerform("DRAFT", "cancel")).toBe(true);
    expect(canPerform("SENT", "cancel")).toBe(true);
    expect(canPerform("PARTIALLY_PAID", "cancel")).toBe(false);
    expect(canPerform("PAID", "cancel")).toBe(false);
  });
});

describe("statusAfterPayment", () => {
  it("moves through partially paid to paid", () => {
    expect(statusAfterPayment("1000.00", "500.00", false)).toBe("PARTIALLY_PAID");
    expect(statusAfterPayment("1000.00", "1000.00", false)).toBe("PAID");
  });

  it("falls back to sent or viewed when payments are removed", () => {
    expect(statusAfterPayment("1000.00", "0.00", false)).toBe("SENT");
    expect(statusAfterPayment("1000.00", "0.00", true)).toBe("VIEWED");
  });
});

describe("emailing", () => {
  it("is allowed in every status but cancelled", () => {
    for (const status of ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID"] as const) {
      expect(canPerform(status, "email")).toBe(true);
    }
    expect(canPerform("CANCELLED", "email")).toBe(false);
  });

  it("does not widen sending itself", () => {
    expect(canPerform("SENT", "send")).toBe(false);
  });
});
