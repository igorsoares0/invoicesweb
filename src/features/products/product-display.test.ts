import { describe, expect, it } from "vitest";
import { formatUnit } from "./product-display";

describe("formatUnit", () => {
  it("prefixes bare units with per", () => {
    expect(formatUnit("month")).toBe("per month");
  });

  it("keeps units that already read naturally", () => {
    expect(formatUnit("per screen")).toBe("per screen");
    expect(formatUnit("Per Hour")).toBe("Per Hour");
  });

  it("shows a dash when there is no unit", () => {
    expect(formatUnit(null)).toBe("—");
  });
});
