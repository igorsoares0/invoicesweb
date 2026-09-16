import { cn } from "cn";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function fieldErrorId(id: string) {
  return `${id}-error`;
}

/** Label + control + inline error. The control should set `aria-invalid` and `aria-describedby={fieldErrorId(id)}`. */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={fieldErrorId(id)} className="text-[12.5px] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Props that wire an input to its Field error. */
export function errorProps(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": fieldErrorId(id) } : {};
}
