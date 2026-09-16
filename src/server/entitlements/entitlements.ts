import type { Entitlements, Plan } from "@/lib/api-types";
import { PLANS } from "./plans";

export function getEntitlements(plan: Plan): Entitlements {
  const definition = PLANS[plan];
  return {
    plan,
    limits: {
      invoicesPerMonth: definition.invoicesPerMonth,
      openEstimates: definition.openEstimates,
    },
    features: {
      templates: [...definition.templates],
      canUseCustomBranding: definition.customBranding,
      canSendReminders: definition.reminders,
      canExportCsv: definition.csvExport,
    },
  };
}
