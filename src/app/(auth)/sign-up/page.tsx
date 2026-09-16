import type { Metadata } from "next";
import Link from "next/link";
import { isGoogleEnabled } from "@/auth";
import { GoogleButton, OrDivider } from "@/features/auth/google-button";
import { SignUpForm } from "@/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[21px] font-semibold">Create your account</h2>
        <p className="mt-1 text-muted-foreground">
          Already have one?{" "}
          <Link href="/sign-in" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </div>
      <GoogleButton enabled={isGoogleEnabled} callbackUrl="/onboarding" />
      <OrDivider />
      <SignUpForm />
    </div>
  );
}
