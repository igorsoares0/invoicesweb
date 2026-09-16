"use client";

import { cn } from "cn";
import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signOutAction } from "@/features/auth/actions";
import { isActive, PHONE_TABS, PRIMARY_NAV, SECONDARY_NAV, type NavCounts, type NavItem } from "./nav-items";

function NavLink({ item, pathname, counts }: { item: NavItem; pathname: string; counts?: NavCounts }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-divider",
            "max-lg:justify-center max-lg:px-0",
            active && "bg-divider font-semibold text-foreground",
          )}
        >
          <Icon className={cn("size-4", active ? "text-ink-3" : "text-line-strong")} strokeWidth={1.6} />
          <span className="max-lg:sr-only">{item.label}</span>
          {item.countKey && counts ? (
            <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground max-lg:hidden">
              {counts[item.countKey]}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  businessName,
  userEmail,
  counts,
}: {
  businessName: string;
  userEmail: string;
  counts: NavCounts;
}) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[60px] shrink-0 flex-col border-r bg-card px-2 py-4 sm:flex lg:w-[230px] lg:px-3">
      <div className="mb-4 flex items-center gap-2.5 px-1 max-lg:justify-center" data-testid="business-chip">
        <LogoMark letter={businessName} />
        <div className="min-w-0 max-lg:sr-only">
          <p className="truncate text-[13px] font-semibold">{businessName}</p>
          <p className="text-[11px] text-muted-2">Free plan</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />
        ))}
        <div className="mx-2 my-2 h-px bg-border" />
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="mt-auto border-t pt-3">
        <p className="truncate px-2.5 pb-1 text-[12px] text-muted-2 max-lg:sr-only">{userEmail}</p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 hover:bg-divider max-lg:justify-center max-lg:px-0"
          >
            <LogOutIcon className="size-4 text-line-strong" strokeWidth={1.6} />
            <span className="max-lg:sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Phone navigation (≤640px): a fixed bottom tab bar. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[62px] grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {PHONE_TABS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-2",
              active && "text-primary",
            )}
          >
            <Icon className="size-5" strokeWidth={1.6} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
