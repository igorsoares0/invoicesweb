"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PHONE_LAYOUT, useMediaQuery, WIDE_LAYOUT } from "@/hooks/use-media-query";

/**
 * The detail aside of the clients and products screens: a fixed column at ≥1280px,
 * a right sheet on tablets and laptops, a bottom sheet on phones.
 */
export function DetailPanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const wide = useMediaQuery(WIDE_LAYOUT);
  const phone = useMediaQuery(PHONE_LAYOUT);

  if (!open) return null;

  if (wide) {
    return (
      <aside
        aria-label={title}
        className="sticky top-14 flex h-[calc(100dvh-56px)] w-[340px] shrink-0 flex-col overflow-y-auto border-l bg-card"
      >
        {children}
      </aside>
    );
  }

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={phone ? "bottom" : "right"}
        className={phone ? "max-h-[88dvh] overflow-y-auto rounded-t-[18px]" : "w-[380px] overflow-y-auto sm:max-w-[380px]"}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}
