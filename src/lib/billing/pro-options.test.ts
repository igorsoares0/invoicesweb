import { describe, expect, it } from "vitest";
import { freeOptions, proOptionsUsed } from "./pro-options";

const free = { templates: ["MODERN", "CLASSIC"], canUseCustomBranding: false };
const pro = { templates: ["MODERN", "CLASSIC", "MINIMAL", "PROFESSIONAL", "BOLD"], canUseCustomBranding: true };

describe("proOptionsUsed", () => {
  it("accepts a free template in the default colour", () => {
    expect(proOptionsUsed({ template: "MODERN", color: "#1e40af" }, free)).toEqual([]);
  });

  it("flags a Pro template on Free", () => {
    expect(proOptionsUsed({ template: "BOLD", color: "#1e40af" }, free)).toEqual(["template"]);
  });

  it("flags a custom colour only where the template paints with it", () => {
    expect(proOptionsUsed({ template: "MODERN", color: "#15803d" }, free)).toEqual(["color"]);
    // Classic ignores the accent by design, so the colour costs nothing there.
    expect(proOptionsUsed({ template: "CLASSIC", color: "#15803d" }, free)).toEqual([]);
  });

  it("compares colours case-insensitively", () => {
    expect(proOptionsUsed({ template: "MODERN", color: "#1E40AF" }, free)).toEqual([]);
  });

  it("flags both at once", () => {
    expect(proOptionsUsed({ template: "PROFESSIONAL", color: "#7c3aed" }, free)).toEqual(["template", "color"]);
  });

  it("allows everything on Pro", () => {
    expect(proOptionsUsed({ template: "PROFESSIONAL", color: "#7c3aed" }, pro)).toEqual([]);
  });
});

describe("freeOptions", () => {
  it("keeps a free template and resets the colour", () => {
    expect(freeOptions({ template: "CLASSIC", color: "#15803d" }, free)).toEqual({ template: "CLASSIC", color: "#1e40af" });
  });

  it("falls back to Modern from a Pro template", () => {
    expect(freeOptions({ template: "BOLD", color: "#15803d" }, free)).toEqual({ template: "MODERN", color: "#1e40af" });
  });
});
