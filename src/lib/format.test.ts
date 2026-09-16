import { describe, expect, it } from "vitest";
import { formatAddress, formatMonthYear, pluralize } from "./format";

describe("formatAddress", () => {
  it("joins the parts that exist and names the country", () => {
    expect(
      formatAddress({ address: "Rua do Século 44", city: "Lisbon", postalCode: "1200-433", country: "PT" }),
    ).toBe("Rua do Século 44, Lisbon 1200-433, Portugal");
  });

  it("returns an empty string when nothing is set", () => {
    expect(formatAddress({ address: null, city: null })).toBe("");
  });
});

describe("formatMonthYear", () => {
  it("formats as short month and year", () => {
    expect(formatMonthYear("2026-03-14T10:00:00.000Z")).toBe("Mar 2026");
  });
});

describe("pluralize", () => {
  it("handles one and many", () => {
    expect(pluralize(1, "client")).toBe("1 client");
    expect(pluralize(5, "client")).toBe("5 clients");
    expect(pluralize(0, "entry", "entries")).toBe("0 entries");
  });
});
