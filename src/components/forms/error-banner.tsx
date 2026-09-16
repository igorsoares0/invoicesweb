import { cn } from "cn";
import type { ReactNode } from "react";

/** The red summary banner used for form-level errors (design a2 / f2). */
export function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-tint px-3.5 py-3 text-[13.5px] font-medium text-danger-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white"
      >
        !
      </span>
      <div>{children}</div>
    </div>
  );
}
