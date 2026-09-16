import { describe, expect, it } from "vitest";
import { addMoney, calculateLine, calculateTotals, compareMoney, percentOf, subtractMoney, type LineInput } from "./math";

const line = (overrides: Partial<LineInput>): LineInput => ({
  quantity: "1",
  unitPrice: "0",
  discountType: null,
  discountValue: null,
  taxRate: "0",
  taxExempt: false,
  ...overrides,
});

describe("calculateLine", () => {
  it("multiplies quantity by price", () => {
    expect(calculateLine(line({ quantity: "12", unitPrice: "320" }))).toEqual({
      subtotal: "3840.00",
      discount: "0.00",
      tax: "0.00",
      total: "3840.00",
    });
  });

  it("applies a percentage discount before VAT", () => {
    expect(
      calculateLine(line({ quantity: "6", unitPrice: "140", discountType: "PERCENT", discountValue: "10", taxRate: "23" })),
    ).toEqual({ subtotal: "840.00", discount: "84.00", tax: "173.88", total: "929.88" });
  });

  it("applies a fixed discount but never below zero", () => {
    expect(calculateLine(line({ unitPrice: "100", discountType: "FIXED", discountValue: "30" })).total).toBe("70.00");
    expect(calculateLine(line({ unitPrice: "100", discountType: "FIXED", discountValue: "250" }))).toMatchObject({
      discount: "100.00",
      total: "0.00",
    });
  });

  it("charges no VAT on exempt lines whatever the rate", () => {
    expect(calculateLine(line({ unitPrice: "140", taxRate: "23", taxExempt: true })).tax).toBe("0.00");
  });

  it("rounds half-up per line on fractional quantities", () => {
    // 3 × 0.335 = 1.005 → 1.01; VAT 23% of 1.01 = 0.2323 → 0.23
    expect(calculateLine(line({ quantity: "3", unitPrice: "0.335", taxRate: "23" }))).toEqual({
      subtotal: "1.01",
      discount: "0.00",
      tax: "0.23",
      total: "1.24",
    });
    expect(calculateLine(line({ quantity: "1.5", unitPrice: "80" })).subtotal).toBe("120.00");
  });

  it("treats a line without a price as zero", () => {
    expect(calculateLine(line({ quantity: "1", unitPrice: null })).total).toBe("0.00");
  });

  it("avoids float drift", () => {
    expect(calculateLine(line({ quantity: "3", unitPrice: "0.1" })).subtotal).toBe("0.30");
  });
});

describe("calculateTotals", () => {
  it("reproduces the design's example invoice", () => {
    const totals = calculateTotals([
      line({ quantity: "1", unitPrice: "2400" }),
      line({ quantity: "12", unitPrice: "320" }),
      line({ quantity: "6", unitPrice: "140", discountType: "PERCENT", discountValue: "10" }),
    ]);
    expect(totals).toEqual({ subtotal: "7080.00", discount: "84.00", tax: "0.00", total: "6996.00" });
  });

  it("sums rounded line taxes rather than re-rounding the total", () => {
    const totals = calculateTotals([
      line({ unitPrice: "0.05", taxRate: "10" }),
      line({ unitPrice: "0.05", taxRate: "10" }),
      line({ unitPrice: "0.05", taxRate: "10" }),
    ]);
    // Each line: 0.005 → 0.01, so 0.03 in VAT (not round(0.015) = 0.02).
    expect(totals.tax).toBe("0.03");
  });

  it("is zero for no lines", () => {
    expect(calculateTotals([]).total).toBe("0.00");
  });
});

describe("money helpers", () => {
  it("adds, subtracts, compares and computes shares", () => {
    expect(addMoney("2000.00", "260.10")).toBe("2260.10");
    expect(subtractMoney("4260.00", "2000.00")).toBe("2260.00");
    expect(compareMoney("10.00", "10")).toBe(0);
    expect(compareMoney("10.01", "10")).toBe(1);
    expect(percentOf("2000", "4260")).toBe(47);
    expect(percentOf("999.00", "1000.00")).toBe(99);
    expect(percentOf("1000", "1000")).toBe(100);
    expect(percentOf("5", "0")).toBe(0);
  });
});
