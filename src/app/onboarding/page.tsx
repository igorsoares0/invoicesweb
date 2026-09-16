import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { requireUser } from "@/server/auth/session";
import { businessService } from "@/server/services/business-service";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await businessService.getForUser(user.id)) redirect("/overview");

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <Wordmark />
        <div className="mt-8 rounded-xl border bg-card px-6 py-7 shadow-card">
          <h1 className="text-[21px] font-semibold">Set up your business</h1>
          <p className="mt-1 mb-6 text-muted-foreground">
            This is who your invoices come from. You can add your address, tax ID and logo later in Settings.
          </p>
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
