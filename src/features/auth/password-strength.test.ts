import { describe, expect, it } from "vitest";
import { measurePassword } from "./password-strength";

describe("measurePassword", () => {
  it("prompts for a password when empty", () => {
    expect(measurePassword("")).toEqual({ score: 0, label: "Use at least 10 characters." });
  });

  it("flags passwords under the server minimum", () => {
    expect(measurePassword("abc")).toEqual({ score: 1, label: "Too short — 3 of 10 characters." });
  });

  it("rates long single-case passwords as fair", () => {
    expect(measurePassword("abcdefghijk").score).toBe(2);
  });

  it("matches the design copy for a 12-character mixed-case password", () => {
    expect(measurePassword("AlvoradaStud")).toEqual({ score: 3, label: "Strong — 12 characters, mixed case." });
  });

  it("rewards length plus variety", () => {
    expect(measurePassword("Correct-Horse-Battery-9").score).toBe(4);
  });
});
