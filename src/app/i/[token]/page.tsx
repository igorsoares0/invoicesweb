import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/auth";
import { DeadLink } from "@/features/public/dead-link";
import { PublicInvoice } from "@/features/public/public-invoice";
import { clientIp, publicDocumentLimiter } from "@/server/auth/rate-limit";
import { publicInvoiceService } from "@/server/services/public-invoice-service";

// Link previews (Slack, WhatsApp, mail scanners) shouldn't count as the client viewing the invoice.
const PREVIEW_AGENTS = /bot|crawler|spider|preview|slack|whatsapp|telegram|discord|facebookexternalhit|skype|outlook|google-read-aloud/i;

export async function generateMetadata({ params }: PageProps<"/i/[token]">): Promise<Metadata> {
  const { token } = await params;
  const invoice = await publicInvoiceService.find(token);
  return {
    title: invoice ? `Invoice ${invoice.number} from ${invoice.issuerName}` : "Link unavailable",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function PublicInvoicePage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const requestHeaders = await headers();

  if (!publicDocumentLimiter.consume(`page:${clientIp(requestHeaders)}`).allowed) {
    return <DeadLink />;
  }

  const invoice = await publicInvoiceService.find(token);
  if (!invoice) return <DeadLink />;

  if (!PREVIEW_AGENTS.test(requestHeaders.get("user-agent") ?? "")) {
    const session = await auth();
    after(() => publicInvoiceService.recordView(token, session?.user?.id ?? null));
  }

  return <PublicInvoice invoice={invoice} token={token} />;
}
