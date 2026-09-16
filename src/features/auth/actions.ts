"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ApiError } from "@/server/api/errors";
import { clientIp, signUpLimiter } from "@/server/auth/rate-limit";
import { userService } from "@/server/services/user-service";

export type SignInState =
  | { status: "idle" }
  | { status: "invalid_credentials"; attemptsLeft: number; email: string }
  | { status: "rate_limited"; email: string }
  | { status: "error"; email: string };

export type SignUpState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]>; email: string };

/** `invalid_credentials:2` → 2. */
function parseAttemptsLeft(code: string): number {
  const attempts = Number(code.split(":")[1]);
  return Number.isInteger(attempts) ? attempts : -1;
}

export async function signInWithPassword(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: safeRedirectPath(formData.get("callbackUrl")),
    });
    return { status: "idle" };
  } catch (error) {
    // A successful sign-in throws Next's redirect, which must propagate.
    if (!(error instanceof AuthError)) throw error;
    if (error instanceof CredentialsSignin && error.code === "rate_limited") return { status: "rate_limited", email };
    if (error instanceof CredentialsSignin) {
      return { status: "invalid_credentials", attemptsLeft: parseAttemptsLeft(error.code), email };
    }
    return { status: "error", email };
  }
}

export async function signUpWithPassword(_state: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const limit = signUpLimiter.consume(clientIp(await headers()));
  if (!limit.allowed) {
    return { status: "invalid", email, fieldErrors: { _form: ["Too many sign-ups from this network. Try again later."] } };
  }

  try {
    await userService.signUp({ email, password });
  } catch (error) {
    if (error instanceof ApiError && error.details) return { status: "invalid", email, fieldErrors: error.details };
    throw error;
  }

  // The business name is collected in onboarding, not here.
  await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  return { status: "idle" };
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeRedirectPath(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
