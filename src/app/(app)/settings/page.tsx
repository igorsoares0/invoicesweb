import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { BusinessProfileForm } from "@/features/settings/business-profile-form";
import { InvoiceDefaultsForm } from "@/features/settings/invoice-defaults-form";
import { requireBusiness } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settings" };

// Templates, Email and Plan & billing join this list in their phases.
const SECTIONS = [
  { href: "#profile", label: "Business profile" },
  { href: "#defaults", label: "Invoice defaults" },
];

export default async function SettingsPage() {
  const { business } = await requireBusiness();
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
        </main>
      </div>
    </>
  );
}
