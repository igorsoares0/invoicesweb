import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordStrengthMeter } from "./password-strength-meter";

describe("PasswordStrengthMeter", () => {
  it("fills one segment per strength point", () => {
    const { container } = render(<PasswordStrengthMeter password="AlvoradaStud" />);
    const filled = container.querySelectorAll('[data-filled="true"]');
    expect(filled).toHaveLength(3);
    expect(screen.getByText("Strong — 12 characters, mixed case.")).toBeInTheDocument();
  });
});
