import type { Plan } from "@/lib/api-types";

export const TEMPLATES = ["MODERN", "CLASSIC", "MINIMAL", "PROFESSIONAL", "BOLD"] as const;

export interface PlanDefinition {
  /** `null` means unlimited. */
  invoicesPerMonth: number | null;
  openEstimates: number | null;
  templates: readonly (typeof TEMPLATES)[number][];
  customBranding: boolean;
  reminders: boolean;
  csvExport: boolean;
}

/** The single source of plan limits (spec §49). The UI reads these through /api/v1/me. */
export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    invoicesPerMonth: 5,
    openEstimates: 3,
    templates: ["MODERN", "CLASSIC"],
    customBranding: false,
    reminders: false,
    csvExport: false,
  },
  PRO: {
    invoicesPerMonth: null,
    openEstimates: null,
    templates: TEMPLATES,
    customBranding: true,
    reminders: true,
    csvExport: true,
  },
};
