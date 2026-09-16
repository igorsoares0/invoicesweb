"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FieldErrors } from "@/lib/validation/errors";
import type { DraftItem } from "./draft-state";
import { LineAdjustments } from "./line-adjustments";

function stepQuantity(quantity: string, delta: number) {
  const next = Math.max(1, Math.round((Number(quantity) || 0) + delta));
  return String(next);
}

/** Phone line editor (design g3): a bottom sheet with a quantity stepper. Edits apply on Save. */
export function PhoneLineSheet({
  item,
  currency,
  errors,
  onSave,
  onRemove,
  onClose,
}: {
  item: DraftItem | null;
  currency: string;
  errors: FieldErrors;
  onSave: (item: DraftItem) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  // The parent keys this component by line id, so the copy resets when another line opens.
  const [editing, setEditing] = useState<DraftItem | null>(item);
  const patch = (changes: Partial<DraftItem>) => setEditing((current) => (current ? { ...current, ...changes } : current));

  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[18px]" showCloseButton={false}>
        <span aria-hidden className="mx-auto mt-2 h-1 w-[38px] rounded-full bg-border" />
        {editing ? (
          <>
            <SheetHeader className="flex-row items-center justify-between px-5 pt-2 pb-0">
              <SheetTitle className="text-[17px] font-semibold">Edit item</SheetTitle>
              <SheetDescription className="sr-only">Change this line and save</SheetDescription>
              <button type="button" className="text-[14px] font-semibold text-destructive" onClick={() => onRemove(editing.id)}>
                Remove
              </button>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sheet-description">Description</Label>
                <Input
                  id="sheet-description"
                  className="h-[46px]"
                  value={editing.description}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sheet-quantity">Qty</Label>
                  <div className="flex h-[46px] items-center rounded-md border">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      className="flex size-11 items-center justify-center"
                      onClick={() => patch({ quantity: stepQuantity(editing.quantity, -1) })}
                    >
                      <MinusIcon className="size-4" />
                    </button>
                    <input
                      id="sheet-quantity"
                      inputMode="decimal"
                      className="w-full min-w-0 bg-transparent text-center text-[15px] font-medium outline-none"
                      value={editing.quantity}
                      onChange={(event) => patch({ quantity: event.target.value })}
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      className="flex size-11 items-center justify-center"
                      onClick={() => patch({ quantity: stepQuantity(editing.quantity, 1) })}
                    >
                      <PlusIcon className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sheet-price">Unit price</Label>
                  <div className="relative">
                    <Input
                      id="sheet-price"
                      inputMode="decimal"
                      className="h-[46px] pr-12"
                      value={editing.unitPrice}
                      onChange={(event) => patch({ unitPrice: event.target.value })}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted-2">
                      {currency}
                    </span>
                  </div>
                </div>
              </div>
              <LineAdjustments item={editing} currency={currency} errors={errors} onChange={patch} />
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-[46px]" onClick={onClose}>
                  Cancel
                </Button>
                <Button className="h-[46px]" onClick={() => onSave(editing)}>
                  Save item
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
