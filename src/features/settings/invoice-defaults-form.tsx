"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api-client";
import type { BusinessDto } from "@/lib/api-types";
import { currencyOptions } from "@/lib/currencies";
import { formatDocumentNumber } from "@/lib/numbering";
import { SettingsCard } from "./settings-card";

const currencies = currencyOptions();
const TIME_ZONES = ["UTC", ...Intl.supportedValuesOf("timeZone")];

function stripZeros(rate: string | null) {
  return rate === null ? "" : rate.replace(/\.00$/, "");
}

export function InvoiceDefaultsForm({ business }: { business: BusinessDto }) {
  const router = useRouter();
  const { error, pending, submit } = useApiForm();
  const [prefix, setPrefix] = useState(business.invoicePrefix);
  const [nextNumber, setNextNumber] = useState(String(business.invoiceNextNumber));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const defaultTaxRate = value("defaultTaxRate").replace(/%$/, "");
    const body = {
      invoicePrefix: prefix,
      invoiceNextNumber: nextNumber,
      estimatePrefix: value("estimatePrefix"),
      estimateNextNumber: value("estimateNextNumber"),
      defaultCurrency: value("defaultCurrency"),
      defaultTaxRate: defaultTaxRate === "" ? null : defaultTaxRate,
      paymentTermsDays: value("paymentTermsDays"),
      timezone: value("timezone"),
    };
    if (await submit(() => api.patch<BusinessDto>("/business", body))) {
      toast.success("Invoice defaults saved");
      router.refresh();
    }
  }

  const parsedNumber = Number(nextNumber);
  const preview =
    Number.isInteger(parsedNumber) && parsedNumber >= 1 ? formatDocumentNumber(prefix, parsedNumber) : "—";

  return (
    <SettingsCard
      id="defaults"
      title="Invoice defaults"
      description="Applied to new documents. Existing invoices keep what they were issued with."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="invoicePrefix" label="Number prefix" error={error("invoicePrefix")}>
            <Input
              id="invoicePrefix"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              className="font-mono"
              {...errorProps("invoicePrefix", error("invoicePrefix"))}
            />
          </Field>
          <Field id="invoiceNextNumber" label="Next number" error={error("invoiceNextNumber")}>
            <Input
              id="invoiceNextNumber"
              inputMode="numeric"
              value={nextNumber}
              onChange={(event) => setNextNumber(event.target.value)}
              className="font-mono"
              {...errorProps("invoiceNextNumber", error("invoiceNextNumber"))}
            />
          </Field>
          <Field id="estimatePrefix" label="Estimate prefix" error={error("estimatePrefix")}>
            <Input
              id="estimatePrefix"
              name="estimatePrefix"
              defaultValue={business.estimatePrefix}
              className="font-mono"
              {...errorProps("estimatePrefix", error("estimatePrefix"))}
            />
          </Field>
          <Field id="defaultCurrency" label="Default currency" error={error("defaultCurrency")}>
            <NativeSelect id="defaultCurrency" name="defaultCurrency" defaultValue={business.defaultCurrency}>
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="defaultTaxRate" label="Default VAT" error={error("defaultTaxRate")}>
            <div className="relative">
              <Input
                id="defaultTaxRate"
                name="defaultTaxRate"
                inputMode="decimal"
                placeholder="None"
                defaultValue={stripZeros(business.defaultTaxRate)}
                className="pr-7"
                {...errorProps("defaultTaxRate", error("defaultTaxRate"))}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-2">%</span>
            </div>
          </Field>
          <Field id="paymentTermsDays" label="Payment terms" error={error("paymentTermsDays")}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-2">Net</span>
              <Input
                id="paymentTermsDays"
                name="paymentTermsDays"
                inputMode="numeric"
                defaultValue={business.paymentTermsDays}
                className="pl-11"
                {...errorProps("paymentTermsDays", error("paymentTermsDays"))}
              />
            </div>
          </Field>
          <Field id="estimateNextNumber" label="Next estimate number" error={error("estimateNextNumber")}>
            <Input
              id="estimateNextNumber"
              name="estimateNextNumber"
              inputMode="numeric"
              defaultValue={business.estimateNextNumber}
              className="font-mono"
              {...errorProps("estimateNextNumber", error("estimateNextNumber"))}
            />
          </Field>
          <Field id="timezone" label="Time zone" error={error("timezone")} className="sm:col-span-2">
            <NativeSelect id="timezone" name="timezone" defaultValue={business.timezone}>
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div
          className="flex flex-col gap-1 rounded-md border bg-canvas-2 px-4 py-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-6"
          data-testid="numbering-preview"
        >
          <span className="text-muted-foreground">
            Next invoice will be <strong className="font-mono font-semibold text-foreground">{preview}</strong>
          </span>
          <span className="text-muted-foreground">Assigned when the draft is created. Deleting a draft leaves a gap.</span>
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save defaults"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
