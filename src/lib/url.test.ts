import { describe, expect, it } from "vitest";
import { withSearchParams } from "./url";

describe("withSearchParams", () => {
  it("sets, replaces and removes params while keeping the rest", () => {
    const current = new URLSearchParams("q=pine&page=2&client=c1");
    expect(withSearchParams("/clients", current, { page: null, q: "vale" })).toBe("/clients?q=vale&client=c1");
  });

  it("drops the question mark when nothing is left", () => {
    expect(withSearchParams("/clients", { q: "pine" }, { q: "" })).toBe("/clients");
  });

  it("accepts plain objects with undefined values", () => {
    expect(withSearchParams("/products", { q: undefined, sort: "name" }, { product: "p1" })).toBe(
      "/products?sort=name&product=p1",
    );
  });
});

describe("firstValues", () => {
  it("keeps the first value of repeated params", async () => {
    const { firstValues } = await import("./url");
    expect(firstValues({ q: ["a", "b"], page: "2", sort: undefined })).toEqual({ q: "a", page: "2", sort: undefined });
  });
});
