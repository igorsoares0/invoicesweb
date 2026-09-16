"use client";

import { cn } from "cn";
import { BoxIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmDeleteDialog } from "@/components/list/confirm-delete-dialog";
import { DetailPanel } from "@/components/list/detail-panel";
import { EmptyState } from "@/components/list/empty-state";
import { Pagination } from "@/components/list/pagination";
import { SearchInput } from "@/components/list/search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { ApiList, ProductDto } from "@/lib/api-types";
import { pluralize } from "@/lib/format";
import { formatMoney, formatPercent } from "@/lib/money";
import { withSearchParams } from "@/lib/url";
import { formatUnit, NEW_PRODUCT } from "./product-display";
import { ProductEditor } from "./product-editor";

export function ProductsScreen({
  result,
  selected,
  creating,
  defaultCurrency,
  defaultTaxRate,
}: {
  result: ApiList<ProductDto>;
  selected: ProductDto | null;
  creating: boolean;
  defaultCurrency: string;
  defaultTaxRate: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toDelete, setToDelete] = useState<ProductDto | null>(null);
  const query = searchParams.get("q");
  const { data: products, pagination } = result;

  const hrefFor = (productId: string | null) => withSearchParams(pathname, searchParams, { product: productId });
  const open = (productId: string | null) => router.replace(hrefFor(productId), { scroll: false });

  return (
    <>
      <PageHeader title="Items & services" actions={<Button onClick={() => open(NEW_PRODUCT)}>New item</Button>} />
      <div className="flex min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <SearchInput label="Search items" placeholder="Search items" />
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {query ? `${pluralize(pagination.total, "match", "matches")} for “${query}”` : pluralize(pagination.total, "item")}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card shadow-card">
            {products.length === 0 ? (
              query ? (
                <EmptyState icon={BoxIcon} title="No items match" body="Try a different name or description." />
              ) : (
                <EmptyState
                  icon={BoxIcon}
                  title="No items yet"
                  body="Save what you sell once — name, price and VAT — and pick it from the catalog on every invoice."
                  action={<Button onClick={() => open(NEW_PRODUCT)}>Add your first item</Button>}
                />
              )
            ) : (
              <>
                <div
                  role="row"
                  className="hidden h-9 grid-cols-[minmax(0,1fr)_110px_120px_72px_28px] items-center gap-3 border-b px-4 text-[11px] font-semibold tracking-[0.02em] text-muted-2 uppercase md:grid"
                >
                  <span>Item</span>
                  <span>Unit</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">VAT</span>
                  <span className="sr-only">Actions</span>
                </div>
                <ul aria-label="Items">
                  {products.map((product) => {
                    const active = selected?.id === product.id;
                    const price = formatMoney(product.unitPrice, product.currency ?? defaultCurrency);
                    const vat = product.taxExempt ? "Exempt" : formatPercent(product.taxRate);
                    return (
                      <li
                        key={product.id}
                        className={cn(
                          "relative grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-3 border-b border-divider px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_110px_120px_72px_28px]",
                          active && "bg-canvas-2 shadow-[inset_2px_0_0_var(--primary)]",
                        )}
                      >
                        <Link
                          href={hrefFor(product.id)}
                          scroll={false}
                          className="min-w-0 after:absolute after:inset-0"
                          aria-current={active ? "true" : undefined}
                        >
                          <span className="block truncate text-sm font-semibold">{product.name}</span>
                          <span className="block truncate text-[12px] text-muted-2">
                            {product.description ?? formatUnit(product.unit)}
                          </span>
                        </Link>
                        <span className="hidden truncate text-[13px] text-ink-3 md:block">{formatUnit(product.unit)}</span>
                        <span className="text-right text-sm font-semibold">
                          {price}
                          <span className={cn("block text-[12px] font-normal md:hidden", product.taxExempt ? "text-warning" : "text-muted-2")}>
                            {vat} VAT
                          </span>
                        </span>
                        <span
                          className={cn(
                            "hidden text-right text-[13px] md:block",
                            product.taxExempt ? "font-medium text-warning" : "text-ink-3",
                          )}
                        >
                          {vat}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="relative z-10 text-muted-2"
                              aria-label={`Actions for ${product.name}`}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => open(product.id)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(product)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-divider px-4 py-3 text-[13px]">
                  <button type="button" onClick={() => open(NEW_PRODUCT)} className="font-semibold text-primary">
                    + New item
                  </button>
                </div>
                <Pagination pathname={pathname} searchParams={Object.fromEntries(searchParams)} {...pagination} />
              </>
            )}
          </div>
        </main>

        <DetailPanel open={creating || selected !== null} onClose={() => open(null)} title="Item editor">
          <ProductEditor
            key={selected?.id ?? NEW_PRODUCT}
            product={selected}
            defaultCurrency={defaultCurrency}
            defaultTaxRate={defaultTaxRate}
            onDelete={setToDelete}
            onDone={({ kind, product }) => {
              toast.success(
                kind === "saved" ? "Item saved" : kind === "created" ? `${product.name} was added` : "Item duplicated",
              );
              open(product.id);
              router.refresh();
            }}
          />
        </DetailPanel>
      </div>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "item"}?`}
        description="It disappears from your catalog. Invoices that already use it keep their lines and prices."
        onConfirm={async () => {
          if (!toDelete) return;
          await api.delete(`/products/${toDelete.id}`);
          toast.success(`${toDelete.name} was deleted`);
          open(null);
          router.refresh();
        }}
      />
    </>
  );
}
