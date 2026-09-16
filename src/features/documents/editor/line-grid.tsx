"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { GripVerticalIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseMoneyInput } from "@/lib/documents/line-text";
import { formatAmount, formatPercent } from "@/lib/money";
import type { Amounts } from "@/lib/documents/math";
import type { FieldErrors } from "@/lib/validation/errors";
import type { DraftItem } from "./draft-state";
import { LineAdjustments } from "./line-adjustments";

// Desktop: handle · description · qty · price · disc · VAT · total · remove. Tablet drops disc and VAT into one button.
const GRID =
  "grid-cols-[18px_minmax(0,1fr)_52px_88px_32px_78px_16px] lg:grid-cols-[18px_minmax(0,1fr)_52px_88px_56px_52px_84px_16px]";

const cellInput =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-sm outline-none hover:border-border focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/12 aria-invalid:border-destructive aria-invalid:text-destructive";

function AdjustPopover({
  item,
  currency,
  errors,
  onChange,
  label,
  children,
  className,
}: {
  item: DraftItem;
  currency: string;
  errors: FieldErrors;
  onChange: (patch: Partial<DraftItem>) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn("h-8 rounded-md px-1 text-right text-sm hover:bg-divider focus-visible:ring-3 focus-visible:ring-ring/12", className)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[290px] shadow-popover">
        <p className="mb-3 text-[13px] font-semibold">Line adjustments</p>
        <LineAdjustments item={item} currency={currency} errors={errors} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function Row({
  item,
  index,
  amounts,
  currency,
  errors,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  amounts: Amounts;
  currency: string;
  errors: FieldErrors;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const path = `items.${item.id}`;
  const fieldError = (field: string) => errors[`${path}.${field}`]?.[0];
  const rowErrors = ["description", "quantity", "unitPrice", "taxExemptReason"]
    .map((field) => fieldError(field))
    .filter(Boolean);
  const hasDiscount = item.discountValue.trim() !== "" && Number(item.discountValue) > 0;
  const discountLabel = hasDiscount
    ? item.discountType === "FIXED"
      ? formatAmount(item.discountValue.replace(/,/g, "") || "0")
      : `${item.discountValue}%`
    : "—";
  const vatLabel = item.taxExempt ? "Exempt" : formatPercent(item.taxRate || "0");
  const lineName = item.description || `line ${index + 1}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative border-b border-divider bg-card last:border-b-0",
        rowErrors.length && "bg-danger-tint-2",
        isDragging && "z-10 shadow-popover",
      )}
      aria-label={`Line ${index + 1}`}
    >
      <div className={cn("grid min-h-[50px] items-center gap-[7px] px-3", GRID)}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex h-8 cursor-grab items-center justify-center text-muted-2 active:cursor-grabbing"
          aria-label={`Reorder ${lineName}`}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
        <input
          aria-label="Description"
          placeholder="Describe the work"
          value={item.description}
          onChange={(event) => onChange({ description: event.target.value })}
          aria-invalid={fieldError("description") ? true : undefined}
          className={cn(cellInput, "font-medium")}
        />
        <input
          aria-label="Quantity"
          inputMode="decimal"
          value={item.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
          aria-invalid={fieldError("quantity") ? true : undefined}
          className={cn(cellInput, "text-right")}
        />
        <input
          aria-label="Unit price"
          inputMode="decimal"
          placeholder="—"
          value={item.unitPrice}
          onChange={(event) => onChange({ unitPrice: event.target.value })}
          onBlur={() => {
            const normalized = parseMoneyInput(item.unitPrice);
            if (normalized && normalized !== item.unitPrice) onChange({ unitPrice: normalized });
          }}
          aria-invalid={fieldError("unitPrice") ? true : undefined}
          className={cn(cellInput, "text-right placeholder:font-semibold placeholder:text-destructive")}
        />
        <AdjustPopover
          item={item}
          currency={currency}
          errors={errors}
          onChange={onChange}
          label={`Discount for ${lineName}`}
          className={cn("hidden lg:block", hasDiscount ? "text-warning" : "text-muted-2")}
        >
          {discountLabel}
        </AdjustPopover>
        <AdjustPopover
          item={item}
          currency={currency}
          errors={errors}
          onChange={onChange}
          label={`VAT for ${lineName}`}
          className={cn("hidden lg:block", item.taxExempt ? "text-warning" : "text-ink-3")}
        >
          {vatLabel}
        </AdjustPopover>
        <AdjustPopover
          item={item}
          currency={currency}
          errors={errors}
          onChange={onChange}
          label={`Adjustments for ${lineName}`}
          className="flex justify-center lg:hidden"
        >
          <SlidersHorizontalIcon className={cn("size-4", hasDiscount || item.taxExempt ? "text-warning" : "text-muted-2")} />
        </AdjustPopover>
        <span className="text-right text-sm font-semibold" data-testid="line-total">
          {formatAmount(amounts.total)}
        </span>
        <button type="button" onClick={onRemove} className="text-muted-2 hover:text-destructive" aria-label={`Remove ${lineName}`}>
          <XIcon className="size-3.5" />
        </button>
      </div>
      {rowErrors.length ? (
        <p className="pr-4 pb-2.5 pl-[39px] text-[13px] text-destructive">{rowErrors[0]}</p>
      ) : null}
    </li>
  );
}

export function LineGrid({
  items,
  lines,
  currency,
  errors,
  onChangeItem,
  onRemoveItem,
  onReorder,
  footer,
}: {
  items: DraftItem[];
  lines: Amounts[];
  currency: string;
  errors: FieldErrors;
  onChangeItem: (id: string, patch: Partial<DraftItem>) => void;
  onRemoveItem: (id: string) => void;
  onReorder: (items: DraftItem[]) => void;
  footer: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(items, from, to));
  }

  return (
    <div>
      <div
        role="row"
        className={cn(
          "grid h-[38px] items-center gap-[7px] border-b px-3 text-[11px] font-semibold tracking-[0.02em] text-muted-2 uppercase",
          GRID,
        )}
      >
        <span />
        <span className="pl-1.5">Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="hidden text-right lg:block">Disc</span>
        <span className="hidden text-right lg:block">VAT</span>
        <span className="lg:hidden" />
        <span className="text-right">Total</span>
        <span />
      </div>
      {items.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ol aria-label="Invoice lines">
              {items.map((item, index) => (
                <Row
                  key={item.id}
                  item={item}
                  index={index}
                  amounts={lines[index]}
                  currency={currency}
                  errors={errors}
                  onChange={(patch) => onChangeItem(item.id, patch)}
                  onRemove={() => onRemoveItem(item.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : null}
      {footer}
    </div>
  );
}
