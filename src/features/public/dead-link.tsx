import { XIcon } from "lucide-react";

/** Shown for revoked, cancelled and unknown links alike, so a link's history isn't disclosed. */
export function DeadLink() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f4f5] px-4 py-10">
      <div className="w-full max-w-[520px] rounded-xl border bg-card px-6 py-9 text-center shadow-card sm:px-10">
        <span className="mx-auto flex size-10 items-center justify-center rounded-[11px] bg-danger-tint text-destructive">
          <XIcon className="size-4" strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 text-[19px] font-semibold">This link no longer works</h1>
        <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-muted-foreground">
          The sender revoked it, or the document was cancelled. If you were about to pay something, check with them
          before sending money.
        </p>
        <p className="mt-6 border-t pt-5 text-[13px] text-muted-2">Nothing was charged and no data was shared.</p>
      </div>
    </main>
  );
}
