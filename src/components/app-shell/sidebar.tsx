"use client";

import { cn } from "cn";
import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signOutAction } from "@/features/auth/actions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isActive, MORE_ICON, MORE_NAV, PHONE_TABS, PRIMARY_NAV, SECONDARY_NAV, type NavCounts, type NavItem } from "./nav-items";

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

/**
 * One document per screen: the editor and detail views are focused flows with their own
 * bottom bar and a back link in the header (design g3), so the tab bar would sit on top of
 * the send button.
 */
function isFocusedDocument(pathname: string) {
  return /^\/(invoices|estimates)\/[^/]+$/.test(pathname);
}

/** Phone navigation (≤640px): a fixed bottom tab bar, with a sheet for the rest. */
export function BottomTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_NAV.some((item) => isActive(pathname, item.href));
  const tabClass = (active: boolean) =>
    cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-2", active && "text-primary");

  if (isFocusedDocument(pathname)) return null;

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[62px] grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {PHONE_TABS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <Icon className="size-5" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
        <button type="button" className={tabClass(moreActive)} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <MORE_ICON className="size-5" strokeWidth={1.6} />
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-[18px] pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">Other sections</SheetDescription>
          </SheetHeader>
          <nav aria-label="More" className="flex flex-col px-2">
            {MORE_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-12 items-center gap-3 rounded-md px-3 text-[15px] font-medium hover:bg-divider"
                >
                  <Icon className="size-5 text-muted-2" strokeWidth={1.6} />
                  {item.label}
                </Link>
              );
            })}
            <form action={signOutAction}>
              <button type="submit" className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-[15px] font-medium hover:bg-divider">
                <LogOutIcon className="size-5 text-muted-2" strokeWidth={1.6} />
                Sign out
              </button>
            </form>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
