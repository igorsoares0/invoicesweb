import type { Metadata } from "next";
import Link from "next/link";
import { isGoogleEnabled } from "@/auth";
import { GoogleButton, OrDivider } from "@/features/auth/google-button";
import { SignInForm } from "@/features/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email already has an account with a password. Sign in with your password below.",
  AccessDenied: "Google sign-in was cancelled.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const callbackUrl = safeRedirectPath(params.callbackUrl);
  const error = typeof params.error === "string" ? params.error : null;
  // CredentialsSignin errors are handled inside the form; anything else from Auth.js lands here.
  const oauthError = error && error !== "CredentialsSignin" ? (OAUTH_ERRORS[error] ?? "Sign-in failed. Try again.") : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[21px] font-semibold">Welcome back</h2>
        <p className="mt-1 text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-primary">
            Create an account
          </Link>
        </p>
      </div>
      <GoogleButton enabled={isGoogleEnabled} callbackUrl={callbackUrl} />
      <OrDivider />
      <SignInForm callbackUrl={callbackUrl} oauthError={oauthError} />
      {isGoogleEnabled ? (
        <p className="border-t pt-5 text-[13px] leading-relaxed text-muted-foreground">
          Signed up with Google before? Use the button above — the password field won&apos;t work for that account.
        </p>
      ) : null}
    </div>
  );
}
