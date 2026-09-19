import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { BusinessProfileForm } from "@/features/settings/business-profile-form";
import { BillingSection } from "@/features/settings/billing-section";
import { InvoiceDefaultsForm } from "@/features/settings/invoice-defaults-form";
import { requireBusiness } from "@/server/auth/session";
import { billingService } from "@/server/services/billing-service";

export const metadata: Metadata = { title: "Settings" };

// Templates and Email join this list in their phases.
const SECTIONS = [
  { href: "#profile", label: "Business profile" },
  { href: "#defaults", label: "Invoice defaults" },
  { href: "#billing", label: "Plan & billing" },
];

export default async function SettingsPage() {
  const { user, business } = await requireBusiness();
  const plan = await billingService.summary({ userId: user.id, businessId: business.id });
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex min-w-0 flex-1">
        <nav
          aria-label="Settings sections"
          className="sticky top-14 hidden h-[calc(100dvh-56px)] w-[196px] shrink-0 flex-col gap-1 border-r bg-card px-3 py-5 lg:flex"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="rounded-md px-3 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-divider"
            >
              {section.label}
            </a>
          ))}
        </nav>
        <main className="flex w-full max-w-[860px] min-w-0 flex-col gap-5 px-4 py-5 sm:px-8 sm:py-7">
          <BusinessProfileForm business={business} />
          <InvoiceDefaultsForm business={business} />
          <BillingSection plan={plan} />
        </main>
      </div>
    </>
  );
}
