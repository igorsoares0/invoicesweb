import { describe, expect, it } from "vitest";
import type { LineInput } from "./math";
import { describeLineMath, parseMoneyInput } from "./line-text";

const line = (overrides: Partial<LineInput>): LineInput => ({
  quantity: "6",
  unitPrice: "140.00",
  discountType: null,
  discountValue: null,
  taxRate: "0.00",
  taxExempt: false,
  ...overrides,
});

describe("describeLineMath", () => {
  it("matches the design's popover example", () => {
    expect(
      describeLineMath(line({ discountType: "PERCENT", discountValue: "10.00", taxExempt: true, taxRate: "0.00" }), "USD"),
    ).toBe("6 × $140 − 10% = $756.00 · no VAT");
  });

  it("shows VAT and fixed discounts", () => {
    expect(describeLineMath(line({ quantity: "12", unitPrice: "320.00", taxRate: "23.00" }), "USD")).toBe(
      "12 × $320 = $3,840.00 · + 23% VAT $883.20",
    );
    expect(describeLineMath(line({ discountType: "FIXED", discountValue: "40.00" }), "EUR")).toBe(
      "6 × €140 − €40.00 = €800.00 · no VAT",
    );
  });

  it("keeps cents and fractional quantities", () => {
    expect(describeLineMath(line({ quantity: "1.500", unitPrice: "80.50" }), "USD")).toBe("1.5 × $80.50 = $120.75 · no VAT");
  });

  it("asks for a price when there is none", () => {
    expect(describeLineMath(line({ unitPrice: null }), "USD")).toBe("Add a price to see the line total");
  });
});

describe("parseMoneyInput", () => {
  it("accepts common ways of typing amounts", () => {
    expect(parseMoneyInput("2,400")).toBe("2400.00");
    expect(parseMoneyInput("$ 140.5")).toBe("140.50");
    expect(parseMoneyInput("0")).toBe("0.00");
  });

  it("returns null for empty or invalid input", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("1.234")).toBeNull();
  });
});
