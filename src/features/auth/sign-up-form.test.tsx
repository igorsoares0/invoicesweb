import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SignUpState } from "./actions";
import { SignUpForm } from "./sign-up-form";

const signUpWithPassword = vi.hoisted(() => vi.fn<(state: SignUpState, form: FormData) => Promise<SignUpState>>());
vi.mock("./actions", () => ({ signUpWithPassword }));

describe("SignUpForm", () => {
  it("updates the strength meter while typing", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Password"), "AlvoradaStud");
    expect(screen.getByText("Strong — 12 characters, mixed case.")).toBeInTheDocument();
  });

  it("renders server field errors next to the fields", async () => {
    signUpWithPassword.mockResolvedValue({
      status: "invalid",
      email: "ana@alvorada.studio",
      fieldErrors: { email: ["An account with this email already exists. Sign in instead."] },
    });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Work email"), "ana@alvorada.studio");
    await user.type(screen.getByLabelText("Password"), "AlvoradaStudio9");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const email = await screen.findByLabelText("Work email");
    expect(await screen.findByText("An account with this email already exists. Sign in instead.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveValue("ana@alvorada.studio");
  });
});
