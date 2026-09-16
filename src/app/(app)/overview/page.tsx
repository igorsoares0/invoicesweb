import { BoxIcon, SettingsIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { formatDocumentNumber } from "@/lib/numbering";
import { requireBusiness } from "@/server/auth/session";

export const metadata: Metadata = { title: "Overview" };

const STEPS = [
  {
    href: "/clients",
    icon: UsersIcon,
    title: "Add your clients",
    body: "Name and billing email are enough to invoice someone.",
  },
  {
    href: "/products",
    icon: BoxIcon,
    title: "Build your catalog",
    body: "Save the services you sell so prices and VAT fill themselves in.",
  },
  {
    href: "/settings",
    icon: SettingsIcon,
    title: "Complete your business profile",
    body: "Address and tax ID print on every invoice.",
  },
];

export default async function OverviewPage() {
  const { business } = await requireBusiness();
  return (
    <>
      <PageHeader title="Overview" />
      <main className="flex flex-col gap-5 px-4 py-5 sm:px-6">
        <section className="rounded-lg border bg-card px-5 py-5 shadow-card">
          <h2 className="text-[17px] font-semibold">Welcome, {business.name}</h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Get ready to send your first invoice. Invoicing arrives next — your first one will be{" "}
            <span className="font-mono text-foreground">
              {formatDocumentNumber(business.invoicePrefix, business.invoiceNextNumber)}
            </span>
            .
          </p>
        </section>
        <section className="grid gap-3.5 md:grid-cols-3">
          {STEPS.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="group rounded-lg border bg-card px-4 py-4 shadow-card transition-colors hover:border-primary/40"
            >
              <step.icon className="size-5 text-primary" strokeWidth={1.6} />
              <p className="mt-3 font-semibold group-hover:text-primary">{step.title}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{step.body}</p>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
