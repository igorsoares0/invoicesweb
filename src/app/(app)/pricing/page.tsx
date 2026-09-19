import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { Pricing } from "@/features/billing/pricing";
import { requireBusiness } from "@/server/auth/session";
import { billingService } from "@/server/services/billing-service";

export const metadata: Metadata = { title: "Plans" };

/**
 * Plans and checkout (design f3). Signed-in only: the button opens a checkout for this account.
 * Paddle's own payment links point here too (`?_ptxn=`), which Paddle.js opens on load.
 */
export default async function PricingPage() {
  const { user, business } = await requireBusiness();
  const plan = await billingService.summary({ userId: user.id, businessId: business.id });
  return (
    <>
      <PageHeader title="Plans" />
      <Pricing plan={plan} />
    </>
  );
}
