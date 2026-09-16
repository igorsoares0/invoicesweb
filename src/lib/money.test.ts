import { describe, expect, it } from "vitest";
import { formatAmount, formatMoney, formatPercent, formatQuantity, MONEY_PATTERN, normalizeDecimal } from "./money";

describe("normalizeDecimal", () => {
  it.each([
    ["12", "12.00"],
    ["12.5", "12.50"],
    ["12.05", "12.05"],
    ["007.10", "7.10"],
    ["0", "0.00"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeDecimal(input)).toBe(expected);
  });
});

describe("MONEY_PATTERN", () => {
  it("accepts up to two decimals and rejects everything else", () => {
    expect(MONEY_PATTERN.test("1200.50")).toBe(true);
    expect(MONEY_PATTERN.test("1200.505")).toBe(false);
    expect(MONEY_PATTERN.test("-1")).toBe(false);
    expect(MONEY_PATTERN.test("1e3")).toBe(false);
    expect(MONEY_PATTERN.test("")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("groups thousands and keeps the exact cents", () => {
    expect(formatMoney("6996", "USD")).toBe("$6,996.00");
    expect(formatMoney("5200.05", "USD")).toBe("$5,200.05");
  });

  it("does not lose precision on amounts beyond float range", () => {
    expect(formatMoney("9999999999.99", "USD")).toBe("$9,999,999,999.99");
  });

  it("uses the currency symbol and locale conventions", () => {
    expect(formatMoney("14300", "EUR", "de-DE")).toBe("14.300,00 €");
  });
});

describe("formatPercent", () => {
  it("drops trailing zeros", () => {
    expect(formatPercent("23.00")).toBe("23%");
    expect(formatPercent("6.50")).toBe("6.5%");
    expect(formatPercent("0.00")).toBe("0%");
  });
});

describe("formatAmount and formatQuantity", () => {
  it("groups without a currency sign", () => {
    expect(formatAmount("2400")).toBe("2,400.00");
    expect(formatAmount("140.5", "de-DE")).toBe("140,50");
  });

  it("trims trailing zeros from quantities", () => {
    expect(formatQuantity("1.500")).toBe("1.5");
    expect(formatQuantity("12")).toBe("12");
    expect(formatQuantity("2.000")).toBe("2");
  });
});
