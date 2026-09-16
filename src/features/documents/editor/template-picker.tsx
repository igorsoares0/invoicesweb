"use client";

import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocumentTemplate } from "@/lib/api-types";
import { ACCENT_COLORS, DOCUMENT_TEMPLATES } from "@/lib/validation/document";

export const TEMPLATE_LABELS: Record<DocumentTemplate, string> = {
  MODERN: "Modern",
  CLASSIC: "Classic",
  MINIMAL: "Minimal",
  PROFESSIONAL: "Professional",
  BOLD: "Bold",
};

/** Free plan gets Modern and Classic; enforcement arrives with billing. */
const PRO_TEMPLATES = new Set<DocumentTemplate>(["MINIMAL", "PROFESSIONAL", "BOLD"]);
const ACCENT_NAMES: Record<string, string> = {
  "#1e40af": "Blue",
  "#18181b": "Black",
  "#15803d": "Green",
  "#b45309": "Amber",
  "#7c3aed": "Violet",
};

/** Schematic thumbnail of each template (design e2). */
function Thumbnail({ template, accent }: { template: DocumentTemplate; accent: string }) {
  return (
    <div className="relative aspect-[1/1.414] w-full overflow-hidden rounded-[5px] border bg-white">
      {template === "PROFESSIONAL" ? <div className="h-[9%] border-b bg-divider" /> : null}
      {template === "BOLD" ? (
        <div className="relative h-[14%] bg-foreground">
          <span className="absolute top-[30%] right-[6%] h-[12%] w-[10%] bg-[#d6ff3f]" />
        </div>
      ) : null}
      <div className="flex flex-col gap-[6%] p-[8%]">
        <span
          className={cn("h-1.5 w-[45%]", template === "CLASSIC" && "mx-auto w-[70%]", template === "MINIMAL" && "h-1 bg-line-strong")}
          style={{
            background:
              template === "MODERN" ? accent : template === "BOLD" ? "#d6ff3f" : template === "MINIMAL" ? undefined : "#18181b",
          }}
        />
        <span className="h-0.5 w-full bg-border" />
        <span className="h-0.5 w-[80%] bg-border" />
        <span className="h-0.5 w-[65%] bg-border" />
      </div>
      <span className={cn("absolute right-[6%] bottom-[5%] h-1 w-[40%]", template === "BOLD" ? "bg-foreground" : "bg-border")} />
    </div>
  );
}

export function TemplatePicker({
  template,
  color,
  onChange,
}: {
  template: DocumentTemplate;
  color: string;
  onChange: (patch: { template?: DocumentTemplate; color?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-1 rounded-md bg-divider p-0.5" role="group" aria-label="Template">
        {(["MODERN", "CLASSIC"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={template === option}
            onClick={() => onChange({ template: option })}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground",
              template === option && "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
            )}
          >
            {TEMPLATE_LABELS[option]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "rounded-[5px] px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground",
            PRO_TEMPLATES.has(template) && "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
          )}
        >
          {PRO_TEMPLATES.has(template) ? TEMPLATE_LABELS[template] : "+3"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Template</DialogTitle>
            <DialogDescription>Applies to this invoice only · changing it never alters what you already sent</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DOCUMENT_TEMPLATES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={template === option}
                aria-label={`${TEMPLATE_LABELS[option]} template`}
                onClick={() => onChange({ template: option })}
                className="flex flex-col gap-1.5 text-left"
              >
                <span className={cn("rounded-md p-0.5", template === option && "shadow-[0_0_0_2px_var(--primary)]")}>
                  <Thumbnail template={option} accent={color} />
                </span>
                <span className="flex items-center gap-1.5 text-[12.5px]">
                  {TEMPLATE_LABELS[option]}
                  {PRO_TEMPLATES.has(option) ? (
                    <span className="rounded bg-divider px-1 text-[10px] font-semibold text-ink-3">PRO</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <AccentSwatches color={color} onChange={(value) => onChange({ color: value })} />
            <span className="text-[12.5px] text-muted-foreground">Minimal, Classic and Bold ignore the accent by design.</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AccentSwatches({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  return (
    <div className="flex items-center gap-2.5" role="radiogroup" aria-label="Accent color">
      {ACCENT_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          role="radio"
          aria-checked={color === swatch}
          aria-label={ACCENT_NAMES[swatch]}
          onClick={() => onChange(swatch)}
          className="size-[22px] rounded-full"
          style={{
            background: swatch,
            boxShadow: color === swatch ? "0 0 0 2px #fff, 0 0 0 3.5px var(--primary)" : undefined,
          }}
        />
      ))}
    </div>
  );
}
