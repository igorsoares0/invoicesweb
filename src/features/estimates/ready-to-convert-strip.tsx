import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { EstimateSummaryDto } from "@/lib/api-types";

function ago(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** The only interruption in the lists: money that's been agreed but not invoiced (designs a1 and c1). */
export function ReadyToConvertStrip({ ready }: { ready: NonNullable<EstimateSummaryDto["readyToConvert"]> }) {
  return (
    <div className="flex flex-col gap-3 border-t bg-canvas-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
        {ready.clientName ? `${ready.clientName} accepted ${ready.number}` : `${ready.number} was accepted`} {ago(ready.acceptedAt)} and
        hasn&apos;t been invoiced yet.
      </p>
      <Link href={`/estimates/${ready.id}?convert=1`} className={buttonVariants()}>
        Convert to invoice
      </Link>
    </div>
  );
}
