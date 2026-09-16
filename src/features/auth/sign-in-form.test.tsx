import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SignInState } from "./actions";
import { SignInForm, signInErrorMessage } from "./sign-in-form";

const signInWithPassword = vi.hoisted(() => vi.fn<(state: SignInState, form: FormData) => Promise<SignInState>>());
vi.mock("./actions", () => ({ signInWithPassword }));

describe("signInErrorMessage", () => {
  it("never says which field was wrong, but counts down the last attempts", () => {
    const state = (attemptsLeft: number): SignInState => ({ status: "invalid_credentials", attemptsLeft, email: "a@b.co" });
    expect(signInErrorMessage(state(4))).toBe("That email and password don't match.");
    expect(signInErrorMessage(state(2))).toBe("That email and password don't match. Two attempts left before a short lockout.");
    expect(signInErrorMessage(state(1))).toBe("That email and password don't match. One attempt left before a short lockout.");
    expect(signInErrorMessage(state(-1))).toBe("That email and password don't match.");
  });

  it("explains a lockout and stays silent when idle", () => {
    expect(signInErrorMessage({ status: "rate_limited", email: "a@b.co" })).toMatch(/Too many attempts/);
    expect(signInErrorMessage({ status: "idle" })).toBeNull();
  });
});

describe("SignInForm", () => {
  it("shows the banner, keeps the email and marks the password field", async () => {
    signInWithPassword.mockResolvedValue({ status: "invalid_credentials", attemptsLeft: 2, email: "ana@alvorada.studio" });
    const user = userEvent.setup();
    render(<SignInForm callbackUrl="/clients" />);

    await user.type(screen.getByLabelText("Email"), "ana@alvorada.studio");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Two attempts left before a short lockout.");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@alvorada.studio");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");

    const submitted = signInWithPassword.mock.calls[0][1];
    expect(submitted.get("callbackUrl")).toBe("/clients");
    expect(submitted.get("password")).toBe("wrong-password");
  });

  it("shows OAuth errors passed from the page", () => {
    render(<SignInForm oauthError="Google sign-in was cancelled." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Google sign-in was cancelled.");
  });
});
