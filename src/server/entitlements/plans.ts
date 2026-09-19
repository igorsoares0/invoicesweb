import type { Plan } from "@/lib/api-types";
import { DOCUMENT_TEMPLATES } from "@/lib/validation/document";

export const TEMPLATES = DOCUMENT_TEMPLATES;

export interface PlanDefinition {
  /** Invoices *sent* per calendar month in the business's timezone. `null` means unlimited. */
  invoicesPerMonth: number | null;
  templates: readonly (typeof TEMPLATES)[number][];
  /** Choosing an accent colour other than the default. */
  customBranding: boolean;
  /** Documents carry "Made with Invoice Maker". */
  brandingMark: boolean;
  reminders: boolean;
  csvExport: boolean;
}

/**
 * The single source of plan limits (spec §49, docs/decisions.md "Billing model"). Estimates,
 * clients and items are unlimited on every plan, so they have no entry here.
 */
export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    invoicesPerMonth: 3,
    templates: ["MODERN", "CLASSIC"],
    customBranding: false,
    brandingMark: true,
    reminders: false,
    csvExport: false,
  },
  PRO: {
    invoicesPerMonth: null,
    templates: TEMPLATES,
    customBranding: true,
    brandingMark: false,
    reminders: true,
    csvExport: true,
  },
};
