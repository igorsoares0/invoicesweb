import { cn } from "cn";

export function InitialAvatar({ name, size = "sm", className }: { name: string; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary-tint-2 font-semibold text-primary",
        size === "sm" ? "size-[26px] text-[12px]" : "size-10 rounded-lg text-[15px]",
        className,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
