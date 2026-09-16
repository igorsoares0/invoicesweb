import { describe, expect, it } from "vitest";
import { getEntitlements } from "./entitlements";

describe("getEntitlements", () => {
  it("limits the free plan", () => {
    expect(getEntitlements("FREE")).toEqual({
      plan: "FREE",
      limits: { invoicesPerMonth: 5, openEstimates: 3 },
      features: {
        templates: ["MODERN", "CLASSIC"],
        canUseCustomBranding: false,
        canSendReminders: false,
        canExportCsv: false,
      },
    });
  });

  it("unlocks everything on pro", () => {
    const pro = getEntitlements("PRO");
    expect(pro.limits).toEqual({ invoicesPerMonth: null, openEstimates: null });
    expect(pro.features.templates).toHaveLength(5);
    expect(pro.features.canUseCustomBranding).toBe(true);
  });

  it("returns copies so callers can't mutate the plan table", () => {
    getEntitlements("FREE").features.templates.push("BOLD");
    expect(getEntitlements("FREE").features.templates).toEqual(["MODERN", "CLASSIC"]);
  });
});
