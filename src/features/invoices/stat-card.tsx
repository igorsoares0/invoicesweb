import { cn } from "cn";
import type { ReactNode } from "react";

/** "$18,420.00" → big "$18,420" + small ".00", as in the design's stat cards. */
function SplitMoney({ value }: { value: string }) {
  const match = value.match(/^(.*?)([.,]\d{2})(\D*)$/);
  if (!match) return <>{value}</>;
  return (
    <>
      {match[1]}
      <span className="text-[13px] font-medium text-muted-2">{match[2]}</span>
      {match[3]}
    </>
  );
}

export function StatCard({
  label,
  value,
  money = false,
  hint,
  tone,
}: {
  label: string;
  value: string;
  money?: boolean;
  hint: ReactNode;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5 shadow-card">
      <p className="text-[12px] font-medium text-muted-2">{label}</p>
      <p className={cn("mt-2 text-[26px] leading-none font-semibold", tone === "danger" && "text-destructive")}>
        {money ? <SplitMoney value={value} /> : value}
      </p>
      <p
        className={cn(
          "mt-2 truncate text-[12.5px] text-muted-foreground",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {hint}
      </p>
    </div>
  );
}
