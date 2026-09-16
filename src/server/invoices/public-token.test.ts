import { describe, expect, it } from "vitest";
import { generatePublicToken, PUBLIC_TOKEN_PATTERN } from "./public-token";

describe("generatePublicToken", () => {
  it("uses the inv_ prefix and an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) expect(generatePublicToken()).toMatch(PUBLIC_TOKEN_PATTERN);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 5000 }, generatePublicToken));
    expect(tokens.size).toBe(5000);
  });
});
