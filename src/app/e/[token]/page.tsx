import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/auth";
import { DeadLink } from "@/features/public/dead-link";
import { PREVIEW_AGENTS } from "@/features/public/preview-agents";
import { PublicEstimate } from "@/features/public/public-estimate";
import { clientIp, publicDocumentLimiter } from "@/server/auth/rate-limit";
import { publicEstimateService } from "@/server/services/public-estimate-service";

export async function generateMetadata({ params }: PageProps<"/e/[token]">): Promise<Metadata> {
  const { token } = await params;
  const estimate = await publicEstimateService.find(token);
  return {
    title: estimate ? `Estimate ${estimate.number} from ${estimate.issuerName}` : "Link unavailable",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function PublicEstimatePage({ params }: PageProps<"/e/[token]">) {
  const { token } = await params;
  const requestHeaders = await headers();

  if (!publicDocumentLimiter.consume(`page:${clientIp(requestHeaders)}`).allowed) return <DeadLink />;

  const estimate = await publicEstimateService.find(token);
  if (!estimate) return <DeadLink />;

  if (!PREVIEW_AGENTS.test(requestHeaders.get("user-agent") ?? "")) {
    const session = await auth();
    after(() => publicEstimateService.recordView(token, session?.user?.id ?? null));
  }

  return <PublicEstimate estimate={estimate} token={token} />;
}
