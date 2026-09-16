import { cn } from "cn";

export function LogoMark({ letter = "I", className }: { letter?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary text-[13px] font-bold text-white",
        className,
      )}
    >
      {letter.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-[34px] rounded-lg text-base" />
      <span className="text-[17px] font-semibold">Invoice Maker</span>
    </span>
  );
}
