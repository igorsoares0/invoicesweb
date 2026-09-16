import { BottomTabs, Sidebar } from "@/components/app-shell/sidebar";
import { requireBusiness } from "@/server/auth/session";
import { invoiceService } from "@/server/services/invoice-service";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, business } = await requireBusiness();
  const invoices = await invoiceService.count({ userId: user.id, businessId: business.id });
  return (
    <div className="flex min-h-dvh">
      <Sidebar businessName={business.name} userEmail={user.email} counts={{ invoices }} />
      <div className="flex min-w-0 flex-1 flex-col pb-[62px] sm:pb-0">{children}</div>
      <BottomTabs />
    </div>
  );
}
