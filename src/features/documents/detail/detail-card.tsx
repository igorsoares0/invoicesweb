import { cn } from "cn";
import type { ReactNode } from "react";

export function DetailCard({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)} aria-label={title}>
      {title ? (
        <div className="flex items-center justify-between px-4 pt-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
