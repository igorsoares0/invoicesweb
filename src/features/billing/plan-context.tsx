"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { PlanSummaryDto } from "@/lib/api-types";

export interface PaddleClientConfig {
  token: string;
  environment: "sandbox" | "production";
}

interface PlanContextValue {
  plan: PlanSummaryDto;
  /** Null when billing isn't configured: upgrade buttons explain instead of opening a checkout. */
  paddle: PaddleClientConfig | null;
  /** Fetches the plan again, e.g. after a 402, when the layout's copy may be stale. */
  refresh: () => Promise<PlanSummaryDto>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

/**
 * The plan summary for the whole app, loaded by the `(app)` layout. Layouts keep their state
 * across navigation, so a fetched copy wins only until the layout hands down a newer one (after a
 * `router.refresh()`), which then takes over again.
 */
export function PlanProvider({
  plan,
  paddle,
  children,
}: {
  plan: PlanSummaryDto;
  paddle: PaddleClientConfig | null;
  children: ReactNode;
}) {
  const [fetched, setFetched] = useState<{ basedOn: PlanSummaryDto; value: PlanSummaryDto } | null>(null);
  const current = fetched && fetched.basedOn === plan ? fetched.value : plan;

  const refresh = useCallback(async () => {
    const value = await api.get<PlanSummaryDto>("/billing");
    setFetched({ basedOn: plan, value });
    return value;
  }, [plan]);

  const value = useMemo(() => ({ plan: current, paddle, refresh }), [current, paddle, refresh]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** The current plan, or null outside the app shell (public pages, isolated component tests). */
export function usePlan(): PlanContextValue | null {
  return useContext(PlanContext);
}
