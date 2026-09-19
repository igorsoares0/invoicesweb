import type { DocumentTemplate } from "@/lib/api-types";

/** The accent colour every document starts with, and the only one Free documents use. */
export const DEFAULT_ACCENT = "#1e40af";

/**
 * Templates that paint with the accent colour (`--doc-accent` in DOCUMENT_CSS). The others ignore
 * it by design, so a colour picked on them costs nothing.
 */
export const ACCENT_TEMPLATES: readonly DocumentTemplate[] = ["MODERN", "PROFESSIONAL"];

export type ProOption = "template" | "color";

/**
 * Which paid options a document uses that the plan doesn't include. Empty means it can be sent
 * as it is. Shared by the send gate and the editor, so both agree on what "Pro" means.
 */
export function proOptionsUsed(
  document: { template: DocumentTemplate; color: string },
  features: { templates: readonly string[]; canUseCustomBranding: boolean },
): ProOption[] {
  const used: ProOption[] = [];
  if (!features.templates.includes(document.template)) used.push("template");
  if (
    !features.canUseCustomBranding &&
    ACCENT_TEMPLATES.includes(document.template) &&
    document.color.toLowerCase() !== DEFAULT_ACCENT
  ) {
    used.push("color");
  }
  return used;
}

/** The closest document a Free plan can send: a free template, the default colour. */
export function freeOptions(
  document: { template: DocumentTemplate; color: string },
  features: { templates: readonly string[] },
): { template: DocumentTemplate; color: string } {
  const template = features.templates.includes(document.template) ? document.template : "MODERN";
  return { template, color: DEFAULT_ACCENT };
}
