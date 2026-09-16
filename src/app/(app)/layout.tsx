import { BottomTabs, Sidebar } from "@/components/app-shell/sidebar";
import { requireBusiness } from "@/server/auth/session";
import { estimateService } from "@/server/services/estimate-service";
import { invoiceService } from "@/server/services/invoice-service";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const [invoices, estimates] = await Promise.all([invoiceService.count(context), estimateService.count(context)]);
  return (
    <div className="flex min-h-dvh">
      <Sidebar businessName={business.name} userEmail={user.email} counts={{ invoices, estimates }} />
      <div className="flex min-w-0 flex-1 flex-col pb-[62px] sm:pb-0">{children}</div>
      <BottomTabs />
    </div>
  );
}
