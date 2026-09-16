"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PHONE_LAYOUT, useMediaQuery } from "@/hooks/use-media-query";

/** A Dialog on larger screens and a bottom Sheet on phones, where a centered modal is cramped. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const phone = useMediaQuery(PHONE_LAYOUT);

  if (phone) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[18px]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="text-[17px] font-semibold">{title}</SheetTitle>
            <SheetDescription className={description ? undefined : "sr-only"}>{description ?? title}</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-5">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold">{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>{description ?? title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
