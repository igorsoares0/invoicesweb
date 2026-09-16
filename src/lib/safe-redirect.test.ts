import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps local paths with their query", () => {
    expect(safeRedirectPath("/clients?q=pine")).toBe("/clients?q=pine");
  });

  it.each([
    ["https://evil.example", "absolute URLs"],
    ["//evil.example", "protocol-relative URLs"],
    ["/\\evil.example", "backslash tricks"],
    ["javascript:alert(1)", "scripts"],
    ["", "empty strings"],
    [undefined, "missing values"],
  ])("falls back for %s (%s)", (value: string | undefined, _reason: string) => {
    expect(safeRedirectPath(value)).toBe("/overview");
  });
});
