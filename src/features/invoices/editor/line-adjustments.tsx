"use client";

import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { currencySymbol } from "@/lib/currencies";
import { describeLineMath } from "@/lib/invoices/line-text";
import { lineInput, type DraftItem } from "./draft-state";

export const VAT_PRESETS = ["0", "6", "13", "23"];

function Segment({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-md border px-3 text-[13px] font-medium",
        active ? "border-foreground bg-foreground text-white" : "bg-card text-ink-3 hover:bg-divider",
      )}
    >
      {children}
    </button>
  );
}

/** Discount, VAT and exemption for one line (design a3). Shared by the popover and the phone sheet. */
export function LineAdjustments({
  item,
  currency,
  errors,
  onChange,
}: {
  item: DraftItem;
  currency: string;
  errors: Record<string, string[]>;
  onChange: (patch: Partial<DraftItem>) => void;
}) {
  const path = `items.${item.id}`;
  const discountError = errors[`${path}.discountValue`]?.[0];
  const reasonError = errors[`${path}.taxExemptReason`]?.[0];
  const kind = item.discountType ?? "PERCENT";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-semibold text-ink-2">Discount</p>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <Segment active={kind === "PERCENT"} onClick={() => onChange({ discountType: "PERCENT" })}>
            % off
          </Segment>
          <Segment active={kind === "FIXED"} onClick={() => onChange({ discountType: "FIXED" })}>
            {currencySymbol(currency)} fixed
          </Segment>
        </div>
        <Input
          aria-label={kind === "PERCENT" ? "Discount percentage" : "Discount amount"}
          inputMode="decimal"
          placeholder={kind === "PERCENT" ? "10" : "50.00"}
          value={item.discountValue}
          aria-invalid={discountError ? true : undefined}
          onChange={(event) => onChange({ discountValue: event.target.value, discountType: kind })}
          className="h-9"
        />
        {discountError ? <p className="text-[12px] text-destructive">{discountError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-semibold text-ink-2">VAT rate</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="VAT rate">
          {VAT_PRESETS.map((rate) => (
            <Segment
              key={rate}
              active={!item.taxExempt && Number(item.taxRate) === Number(rate)}
              onClick={() => onChange({ taxRate: rate, taxExempt: false })}
            >
              {rate}%
            </Segment>
          ))}
          <Input
            aria-label="Custom VAT rate"
            inputMode="decimal"
            className="h-9 w-20"
            disabled={item.taxExempt}
            value={VAT_PRESETS.some((rate) => Number(rate) === Number(item.taxRate)) ? "" : item.taxRate}
            placeholder="Other"
            onChange={(event) => onChange({ taxRate: event.target.value || "0" })}
          />
        </div>
        <label className="mt-1 flex items-center gap-2 text-[13px] text-ink-3">
          <Checkbox
            checked={item.taxExempt}
            onCheckedChange={(checked) => onChange({ taxExempt: checked === true, ...(checked === true ? { taxRate: "0" } : {}) })}
          />
          Exempt — reason required on the PDF
        </label>
        {item.taxExempt ? (
          <>
            <Input
              aria-label="Exemption reason"
              placeholder="Art. 53 CIVA — small business exemption"
              value={item.taxExemptReason}
              aria-invalid={reasonError ? true : undefined}
              onChange={(event) => onChange({ taxExemptReason: event.target.value })}
              className="h-9"
            />
            {reasonError ? <p className="text-[12px] text-destructive">{reasonError}</p> : null}
          </>
        ) : null}
      </div>

      <p className="rounded-md bg-canvas-2 px-3 py-2 text-[13px] text-muted-foreground" data-testid="line-math">
        {describeLineMath(lineInput(item), currency)}
      </p>
    </div>
  );
}
