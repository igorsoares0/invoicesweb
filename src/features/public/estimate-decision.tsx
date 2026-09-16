"use client";

import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function useEstimateReply(token: string) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reply(answer: "accept" | "decline") {
    setPending(answer);
    setError(null);
    try {
      const response = await fetch(`/e/${token}/${answer}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Something went wrong. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return { reply, pending, error };
}

/**
 * Accept / Decline for the client (design d2). Declining is neutral, never red, and asks for a
 * second click; accepting says plainly that nothing is charged.
 */
export function EstimateDecision({
  token,
  issuerName,
  layout = "bar",
}: {
  token: string;
  issuerName: string;
  layout?: "bar" | "phone";
}) {
  const { reply, pending, error } = useEstimateReply(token);
  const [confirmDecline, setConfirmDecline] = useState(false);

  const buttons = (
    <>
      <Button
        variant="outline"
        size="lg"
        className={cn(layout === "phone" && "h-11 w-full")}
        disabled={pending !== null}
        onClick={() => setConfirmDecline(true)}
      >
        Decline
      </Button>
      <Button
        size="lg"
        className={cn("bg-success text-white hover:bg-success/90", layout === "phone" && "h-11 w-full")}
        disabled={pending !== null}
        onClick={() => reply("accept")}
      >
        {pending === "accept" ? "Accepting…" : "Accept estimate"}
      </Button>
    </>
  );

  return (
    <>
      {layout === "bar" ? (
        <section
          aria-label="Your decision"
          className="mb-4 flex flex-col gap-3 rounded-lg border bg-card px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between print:hidden"
        >
          <div>
            <h2 className="text-[16px] font-semibold">Does this look right?</h2>
            <p className="text-[14px] text-muted-foreground">
              Accepting doesn&apos;t charge you — {issuerName} will send an invoice with these prices.
            </p>
            {error ? (
              <p role="alert" className="mt-1 text-[13.5px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">{buttons}</div>
        </section>
      ) : (
        <>
          {error ? (
            <p role="alert" className="col-span-2 text-[13px] text-destructive">
              {error}
            </p>
          ) : null}
          {buttons}
        </>
      )}

      <AlertDialog open={confirmDecline} onOpenChange={setConfirmDecline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              {issuerName} will see that you declined. If you only want changes, reply to them instead — they can send a new
              estimate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it open</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={pending !== null}
              onClick={async () => {
                await reply("decline");
                setConfirmDecline(false);
              }}
            >
              {pending === "decline" ? "Declining…" : "Decline estimate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
