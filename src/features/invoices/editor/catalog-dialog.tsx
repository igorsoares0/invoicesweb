"use client";

import { BoxIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProductDto } from "@/lib/api-types";
import { formatMoney, formatPercent } from "@/lib/money";

export function CatalogDialog({
  open,
  onOpenChange,
  products,
  currency,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductDto[];
  currency: string;
  onPick: (product: ProductDto) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? products.filter((product) => `${product.name} ${product.description ?? ""}`.toLowerCase().includes(needle))
      : products;
  }, [products, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add from catalog</DialogTitle>
          <DialogDescription>Price and VAT come from the item; you can still change them on this invoice.</DialogDescription>
        </DialogHeader>
        <Input autoFocus aria-label="Search catalog" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul aria-label="Catalog items" className="-mx-2 max-h-80 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[13px] text-muted-foreground">
              <BoxIcon className="size-5 text-muted-2" />
              {products.length ? "No items match." : "Your catalog is empty. Add items under Products."}
            </li>
          ) : (
            matches.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(product);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-divider"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="block truncate text-[12px] text-muted-2">{product.description ?? product.unit ?? ""}</span>
                  </span>
                  <span className="text-right text-[13px]">
                    <span className="block font-semibold">{formatMoney(product.unitPrice, product.currency ?? currency)}</span>
                    <span className={product.taxExempt ? "text-warning" : "text-muted-2"}>
                      {product.taxExempt ? "Exempt" : `VAT ${formatPercent(product.taxRate)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
