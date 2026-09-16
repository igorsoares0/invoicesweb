"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api-client";
import type { BusinessDto } from "@/lib/api-types";
import { countryOptions } from "@/lib/countries";
import { currencyOptions } from "@/lib/currencies";

const countries = countryOptions();
const currencies = currencyOptions();

export function OnboardingForm() {
  const router = useRouter();
  const { error, pending, submit } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const business = await submit(() =>
      api.post<BusinessDto>("/business", {
        name: form.get("name"),
        country: form.get("country"),
        defaultCurrency: form.get("defaultCurrency"),
      }),
    );
    if (business) {
      router.replace("/overview");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}
      <Field id="name" label="Business name" error={error("name")} hint="Printed at the top of every invoice.">
        <Input id="name" name="name" autoComplete="organization" required autoFocus {...errorProps("name", error("name"))} />
      </Field>
      <Field id="country" label="Country" error={error("country")}>
        <NativeSelect id="country" name="country" defaultValue="" {...errorProps("country", error("country"))}>
          <option value="">Select a country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        id="defaultCurrency"
        label="Default currency"
        error={error("defaultCurrency")}
        hint="Each invoice keeps its own currency; you can change it per document."
      >
        <NativeSelect
          id="defaultCurrency"
          name="defaultCurrency"
          defaultValue="USD"
          {...errorProps("defaultCurrency", error("defaultCurrency"))}
        >
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" size="lg" className="mt-2 w-full text-sm" disabled={pending}>
        {pending ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}
