"use client";

import { useActionState } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithPassword, type SignInState } from "./actions";
import { PasswordInput } from "./password-input";

const ATTEMPT_WORDS = ["No attempts", "One attempt", "Two attempts"];

export function signInErrorMessage(state: SignInState): string | null {
  switch (state.status) {
    case "invalid_credentials": {
      const base = "That email and password don't match.";
      if (state.attemptsLeft < 0 || state.attemptsLeft > 2) return base;
      return `${base} ${ATTEMPT_WORDS[state.attemptsLeft]} left before a short lockout.`;
    }
    case "rate_limited":
      return "Too many attempts. Wait 15 minutes before trying again.";
    case "error":
      return "Something went wrong signing you in. Try again.";
    default:
      return null;
  }
}

export function SignInForm({ callbackUrl, oauthError }: { callbackUrl?: string; oauthError?: string | null }) {
  const [state, formAction, pending] = useActionState(signInWithPassword, { status: "idle" });
  const message = signInErrorMessage(state) ?? oauthError ?? null;
  const email = state.status === "idle" ? "" : state.email;
  const passwordError = state.status === "invalid_credentials" ? "Check your password" : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {message ? <ErrorBanner>{message}</ErrorBanner> : null}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/overview"} />
      <Field id="email" label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          key={email}
          required
          className="h-10"
        />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          {...errorProps("password", passwordError)}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-1 w-full text-sm" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
