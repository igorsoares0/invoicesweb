"use client";

import { useActionState, useState } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpWithPassword } from "./actions";
import { PasswordInput } from "./password-input";
import { PasswordStrengthMeter } from "./password-strength-meter";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpWithPassword, { status: "idle" });
  const [password, setPassword] = useState("");
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {errors._form ? <ErrorBanner>{errors._form[0]}</ErrorBanner> : null}
      <Field id="email" label="Work email" error={errors.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.status === "invalid" ? state.email : ""}
          required
          className="h-10"
          {...errorProps("email", errors.email?.[0])}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password?.[0]}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-strength"
          {...errorProps("password", errors.password?.[0])}
        />
        <PasswordStrengthMeter password={password} id="password-strength" />
      </Field>
      <Button type="submit" size="lg" className="mt-1 w-full text-sm" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        By creating an account you agree to the Terms and Privacy Policy. We email you about your invoices, not
        about features.
      </p>
    </form>
  );
}
