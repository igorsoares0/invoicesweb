import { describe, expect, it } from "vitest";
import { createBusinessSchema, updateBusinessSchema } from "./business";

describe("createBusinessSchema", () => {
  it("defaults the currency to USD", () => {
    expect(createBusinessSchema.parse({ name: "Alvorada Studio" })).toEqual({
      name: "Alvorada Studio",
      defaultCurrency: "USD",
    });
  });

  it("requires a name", () => {
    expect(createBusinessSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("updateBusinessSchema", () => {
  it("accepts a partial update", () => {
    expect(updateBusinessSchema.parse({ invoicePrefix: "AS-", invoiceNextNumber: "45" })).toEqual({
      invoicePrefix: "AS-",
      invoiceNextNumber: 45,
    });
  });

  it("rejects prefixes with spaces or that are too long", () => {
    expect(updateBusinessSchema.safeParse({ invoicePrefix: "INV 2026" }).success).toBe(false);
    expect(updateBusinessSchema.safeParse({ invoicePrefix: "ABCDEFGHIJKLM" }).success).toBe(false);
  });

  it("rejects a next number below 1 and non-integers", () => {
    expect(updateBusinessSchema.safeParse({ invoiceNextNumber: 0 }).success).toBe(false);
    expect(updateBusinessSchema.safeParse({ invoiceNextNumber: 1.5 }).success).toBe(false);
  });

  it("validates time zones and allows clearing the default VAT", () => {
    expect(updateBusinessSchema.safeParse({ timezone: "Europe/Lisbon" }).success).toBe(true);
    expect(updateBusinessSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
    expect(updateBusinessSchema.parse({ defaultTaxRate: null })).toEqual({ defaultTaxRate: null });
  });
});
