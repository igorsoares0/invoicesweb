import { BottomTabs, Sidebar } from "@/components/app-shell/sidebar";
import { PlanProvider } from "@/features/billing/plan-context";
import { requireBusiness } from "@/server/auth/session";
import { paddleClientConfig } from "@/server/billing/paddle";
import { billingService } from "@/server/services/billing-service";
import { estimateService } from "@/server/services/estimate-service";
import { invoiceService } from "@/server/services/invoice-service";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const [invoices, estimates, plan] = await Promise.all([
    invoiceService.count(context),
    estimateService.count(context),
    billingService.summary(context),
  ]);
  return (
    <PlanProvider plan={plan} paddle={paddleClientConfig()}>
      <div className="flex min-h-dvh">
        <Sidebar businessName={business.name} userEmail={user.email} counts={{ invoices, estimates }} />
        <div className="flex min-w-0 flex-1 flex-col pb-[62px] sm:pb-0">{children}</div>
        <BottomTabs />
      </div>
    </PlanProvider>
  );
}
