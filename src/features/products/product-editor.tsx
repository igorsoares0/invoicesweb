"use client";

import { useState, type FormEvent } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api-client";
import type { ProductDto } from "@/lib/api-types";
import { currencyOptions } from "@/lib/currencies";
import { formatMoney } from "@/lib/money";

const currencies = currencyOptions();

export type ProductEditorResult = { kind: "saved" | "created" | "duplicated"; product: ProductDto };

export function ProductEditor({
  product,
  defaultCurrency,
  defaultTaxRate,
  onDone,
  onDelete,
}: {
  product: ProductDto | null;
  defaultCurrency: string;
  defaultTaxRate: string | null;
  onDone: (result: ProductEditorResult) => void;
  onDelete: (product: ProductDto) => void;
}) {
  const { error, pending: requestPending, submit: run } = useApiForm();
  const [action, setAction] = useState<"save" | "duplicate">("save");
  const [exempt, setExempt] = useState(product?.taxExempt ?? false);
  const pending = requestPending ? action : null;

  function readForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    return {
      name: text("name"),
      description: text("description"),
      unit: text("unit"),
      unitPrice: text("unitPrice").replace(/,/g, ""),
      currency: text("currency"),
      taxRate: exempt ? "0" : text("taxRate").replace(/%$/, "") || "0",
      taxExempt: exempt,
      taxExemptReason: exempt ? text("taxExemptReason") : "",
    };
  }

  async function submit(body: ReturnType<typeof readForm>, next: "save" | "duplicate") {
    setAction(next);
    const result = await run(async (): Promise<ProductEditorResult> => {
      if (next === "duplicate") {
        return { kind: "duplicated", product: await api.post<ProductDto>("/products", { ...body, name: `${body.name} (copy)` }) };
      }
      if (product) return { kind: "saved", product: await api.patch<ProductDto>(`/products/${product.id}`, body) };
      return { kind: "created", product: await api.post<ProductDto>("/products", body) };
    });
    if (result) onDone(result);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(readForm(event.currentTarget), "save");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-5 py-5" noValidate>
      <h2 className="pr-8 text-[17px] font-semibold xl:pr-0">{product ? "Edit item" : "New item"}</h2>
      {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}

      <Field id="product-name" label="Name" error={error("name")}>
        <Input
          id="product-name"
          name="name"
          defaultValue={product?.name ?? ""}
          autoFocus={!product}
          {...errorProps("product-name", error("name"))}
        />
      </Field>
      <Field id="product-description" label="Description" error={error("description")}>
        <Textarea id="product-description" name="description" rows={3} defaultValue={product?.description ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="product-unit" label="Unit" error={error("unit")}>
          <Input id="product-unit" name="unit" placeholder="hour" defaultValue={product?.unit ?? ""} />
        </Field>
        <Field id="product-price" label="Unit price" error={error("unitPrice")}>
          <Input
            id="product-price"
            name="unitPrice"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={product?.unitPrice ?? ""}
            {...errorProps("product-price", error("unitPrice"))}
          />
        </Field>
        <Field id="product-vat" label="VAT rate" error={error("taxRate")}>
          <div className="relative">
            <Input
              id="product-vat"
              name="taxRate"
              inputMode="decimal"
              disabled={exempt}
              defaultValue={product ? product.taxRate.replace(/\.00$/, "") : (defaultTaxRate?.replace(/\.00$/, "") ?? "0")}
              className="pr-7"
              {...errorProps("product-vat", error("taxRate"))}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-2">%</span>
          </div>
        </Field>
        <Field id="product-currency" label="Currency" error={error("currency")}>
          <NativeSelect id="product-currency" name="currency" defaultValue={product?.currency ?? ""}>
            <option value="">{defaultCurrency} (default)</option>
            {currencies.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <Checkbox checked={exempt} onCheckedChange={(checked) => setExempt(checked === true)} name="taxExempt" />
          Exempt — reason required on the PDF
        </label>
        {exempt ? (
          <Field id="product-exempt-reason" label="Exemption reason" error={error("taxExemptReason")}>
            <Input
              id="product-exempt-reason"
              name="taxExemptReason"
              placeholder="Art. 53 CIVA — small business exemption"
              defaultValue={product?.taxExemptReason ?? ""}
              {...errorProps("product-exempt-reason", error("taxExemptReason"))}
            />
          </Field>
        ) : null}
      </div>

      {product ? (
        <div className="rounded-[7px] border bg-canvas-2 px-4 py-3 text-[13px]">
          <p className="font-semibold">Changing the price is safe</p>
          <p className="mt-0.5 text-muted-foreground">
            Invoices already issued keep the price they were sent with. New invoices pick up{" "}
            {formatMoney(product.unitPrice, product.currency ?? defaultCurrency)}.
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 pt-2">
        <Button type="submit" size="lg" disabled={pending !== null}>
          {pending === "save" ? "Saving…" : product ? "Save item" : "Add item"}
        </Button>
        {product ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending !== null}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) void submit(readForm(form), "duplicate");
              }}
            >
              {pending === "duplicate" ? "Duplicating…" : "Duplicate"}
            </Button>
            <button
              type="button"
              onClick={() => onDelete(product)}
              className="ml-auto text-[13px] font-semibold text-destructive"
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
