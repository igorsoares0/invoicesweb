import { describe, expect, it } from "vitest";
import { extractIban, formatIban } from "./iban";

describe("extractIban", () => {
  it("finds a spaced IBAN in instructions", () => {
    expect(extractIban("Bank transfer — IBAN PT50 0002 0123 1234 5678 9015 4. Please reference INV-0044.")).toBe(
      "PT50000201231234567890154",
    );
  });

  it("finds a compact IBAN", () => {
    expect(extractIban("IBAN: DE89370400440532013000")).toBe("DE89370400440532013000");
  });

  it("ignores text without one", () => {
    expect(extractIban("Pay by card at alvorada.studio/pay")).toBeNull();
    expect(extractIban("Reference INV-0044")).toBeNull();
    expect(extractIban(null)).toBeNull();
  });
});

describe("formatIban", () => {
  it("groups in fours", () => {
    expect(formatIban("PT50000201231234567890154")).toBe("PT50 0002 0123 1234 5678 9015 4");
  });
});
