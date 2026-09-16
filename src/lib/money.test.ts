import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, MONEY_PATTERN, normalizeDecimal } from "./money";

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
