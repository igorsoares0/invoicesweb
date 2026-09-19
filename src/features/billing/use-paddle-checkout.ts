"use client";

import type { Paddle } from "@paddle/paddle-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { BillingInterval, PlanSummaryDto } from "@/lib/api-types";
import { usePlan } from "./plan-context";

const SYNC_ATTEMPTS = 10;
const SYNC_INTERVAL_MS = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Paddle overlay checkout. The transaction is created by our server (price and account are
 * fixed there); after `checkout.completed` the subscription is pulled from Paddle until Pro
 * shows up, so the upgrade lands even before — or without — the webhook.
 */
export function usePaddleCheckout() {
  const router = useRouter();
  const planContext = usePlan();
  const config = planContext?.paddle ?? null;
  const paddle = useRef<Paddle | null>(null);
  const [state, setState] = useState<"idle" | "opening" | "activating">("idle");

  const activate = useCallback(
    async (transactionId: string) => {
      setState("activating");
      for (let attempt = 0; attempt < SYNC_ATTEMPTS; attempt += 1) {
        try {
          const plan = await api.post<PlanSummaryDto>("/billing/sync", { transactionId });
          if (plan.source === "subscription") {
            paddle.current?.Checkout.close();
            toast.success("You're on Pro. Thanks!");
            setState("idle");
            router.refresh();
            return;
          }
        } catch {
          // Paddle may still be creating the subscription; try again.
        }
        await wait(SYNC_INTERVAL_MS);
      }
      setState("idle");
      toast("Payment received. Pro will show up in a moment.");
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void import("@paddle/paddle-js").then(({ initializePaddle }) =>
      initializePaddle({
        token: config.token,
        environment: config.environment,
        eventCallback: (event) => {
          if (event.name === "checkout.completed" && event.data?.transaction_id) void activate(event.data.transaction_id);
        },
      }).then((instance) => {
        if (!cancelled) paddle.current = instance ?? null;
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [activate, config]);

  const open = useCallback(
    async (interval: BillingInterval) => {
      if (!config) {
        toast.error("Billing isn't set up on this server yet.");
        return;
      }
      setState("opening");
      try {
        const { transactionId, customerEmail } = await api.post<{ transactionId: string; customerEmail: string }>(
          "/billing/checkout",
          { interval },
        );
        paddle.current?.Checkout.open({
          transactionId,
          customer: { email: customerEmail },
          settings: { displayMode: "overlay", theme: "light" },
        });
      } catch (error) {
        toast.error(error instanceof ApiClientError ? error.message : "Couldn't open the checkout");
      } finally {
        setState((current) => (current === "opening" ? "idle" : current));
      }
    },
    [config],
  );

  return { open, state, available: Boolean(config) };
}
