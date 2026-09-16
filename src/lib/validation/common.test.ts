import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  currencyCode,
  listQuery,
  moneyAmount,
  optionalCountryCode,
  optionalEmail,
  optionalText,
  percentage,
} from "./common";
import { toFieldErrors } from "./errors";

describe("optionalText", () => {
  const schema = optionalText(5);

  it("trims, turns empty strings into null and keeps undefined", () => {
    expect(schema.parse("  hi  ")).toBe("hi");
    expect(schema.parse("   ")).toBeNull();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it("enforces the maximum length", () => {
    expect(schema.safeParse("toolong").success).toBe(false);
  });
});

describe("optionalEmail", () => {
  it("lowercases valid emails and clears empty ones", () => {
    expect(optionalEmail.parse(" Ana@Halcyon.CO ")).toBe("ana@halcyon.co");
    expect(optionalEmail.parse("")).toBeNull();
  });

  it("rejects malformed emails", () => {
    expect(optionalEmail.safeParse("not-an-email").success).toBe(false);
  });
});

describe("currencyCode", () => {
  it("accepts ISO 4217 codes in any case", () => {
    expect(currencyCode.parse("eur")).toBe("EUR");
    expect(currencyCode.parse("BRL")).toBe("BRL");
  });

  it("rejects unknown codes", () => {
    expect(currencyCode.safeParse("XYZ1").success).toBe(false);
    expect(currencyCode.safeParse("ABC").success).toBe(false);
  });
});

describe("optionalCountryCode", () => {
  it("accepts ISO 3166 alpha-2 codes", () => {
    expect(optionalCountryCode.parse("pt")).toBe("PT");
    expect(optionalCountryCode.parse("")).toBeNull();
  });

  it("rejects unknown codes", () => {
    expect(optionalCountryCode.safeParse("ZZ").success).toBe(false);
  });
});

describe("moneyAmount", () => {
  it("normalizes strings and plain numbers", () => {
    expect(moneyAmount.parse("1200.5")).toBe("1200.50");
    expect(moneyAmount.parse(140)).toBe("140.00");
  });

  it("rejects negatives, extra precision and float artifacts", () => {
    expect(moneyAmount.safeParse("-1").success).toBe(false);
    expect(moneyAmount.safeParse("1.234").success).toBe(false);
    expect(moneyAmount.safeParse(0.1 + 0.2).success).toBe(false);
  });
});

describe("percentage", () => {
  it("accepts 0 to 100", () => {
    expect(percentage.parse("23")).toBe("23.00");
    expect(percentage.parse("0")).toBe("0.00");
    expect(percentage.parse("100")).toBe("100.00");
  });

  it("rejects values above 100", () => {
    expect(percentage.safeParse("100.01").success).toBe(false);
    expect(percentage.safeParse("230").success).toBe(false);
  });
});

describe("listQuery", () => {
  const schema = listQuery(["name", "createdAt"] as const, { sort: "name", order: "asc" });

  it("applies defaults", () => {
    expect(schema.parse({})).toEqual({ page: 1, limit: 20, sort: "name", order: "asc" });
  });

  it("coerces query-string numbers and drops blank searches", () => {
    expect(schema.parse({ page: "3", limit: "50", q: "  ", sort: "createdAt", order: "desc" })).toEqual({
      page: 3,
      limit: 50,
      q: undefined,
      sort: "createdAt",
      order: "desc",
    });
  });

  it("rejects out-of-range pagination and unknown sort fields", () => {
    expect(schema.safeParse({ page: "0" }).success).toBe(false);
    expect(schema.safeParse({ limit: "101" }).success).toBe(false);
    expect(schema.safeParse({ sort: "passwordHash" }).success).toBe(false);
  });
});

describe("toFieldErrors", () => {
  it("groups messages by field path", () => {
    const schema = z.object({ name: z.string().min(1, "Name is required"), email: z.email("Bad email") });
    const result = schema.safeParse({ name: "", email: "x" });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)).toEqual({ name: ["Name is required"], email: ["Bad email"] });
  });

  it("puts issues without a path under _form", () => {
    const schema = z.object({ name: z.string() }).refine(() => false, "Whole form is wrong");
    const result = schema.safeParse({ name: "a" });
    expect(toFieldErrors(result.error!)).toEqual({ _form: ["Whole form is wrong"] });
  });
});
