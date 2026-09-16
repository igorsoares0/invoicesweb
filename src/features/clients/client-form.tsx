"use client";

import type { FormEvent } from "react";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api-client";
import type { ClientDto } from "@/lib/api-types";
import { countryOptions } from "@/lib/countries";
import { currencyOptions } from "@/lib/currencies";

const countries = countryOptions();
const currencies = currencyOptions();

const TEXT_FIELDS = ["name", "email", "phone", "company", "taxId", "address", "city", "state", "postalCode"] as const;

export function ClientForm({
  client,
  defaultCurrency,
  onSaved,
  onCancel,
}: {
  client?: ClientDto;
  defaultCurrency: string;
  onSaved: (client: ClientDto) => void;
  onCancel: () => void;
}) {
  const { error, pending, submit } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      [...TEXT_FIELDS, "country", "currency", "notes"].map((field) => [field, String(form.get(field) ?? "")]),
    );
    const saved = await submit(() =>
      client ? api.patch<ClientDto>(`/clients/${client.id}`, body) : api.post<ClientDto>("/clients", body),
    );
    if (saved) onSaved(saved);
  }

  const text = (id: (typeof TEXT_FIELDS)[number], label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field id={`client-${id}`} label={label} error={error(id)}>
      <Input
        id={`client-${id}`}
        name={id}
        defaultValue={client?.[id] ?? ""}
        {...props}
        {...errorProps(`client-${id}`, error(id))}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Name", { required: true, autoFocus: true, className: "sm:col-span-2" })}
        {text("email", "Billing email", { type: "email", autoComplete: "off" })}
        {text("phone", "Phone", { type: "tel" })}
        {text("company", "Company")}
        {text("taxId", "Tax ID / VAT")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{text("address", "Address")}</div>
        {text("city", "City")}
        {text("state", "State / region")}
        {text("postalCode", "Postal code")}
        <Field id="client-country" label="Country" error={error("country")}>
          <NativeSelect
            id="client-country"
            name="country"
            defaultValue={client?.country ?? ""}
            {...errorProps("client-country", error("country"))}
          >
            <option value="">—</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          id="client-currency"
          label="Currency"
          error={error("currency")}
          hint="Suggested for new invoices to this client."
          className="sm:col-span-2"
        >
          <NativeSelect
            id="client-currency"
            name="currency"
            defaultValue={client?.currency ?? ""}
            {...errorProps("client-currency", error("currency"))}
          >
            <option value="">Business default ({defaultCurrency})</option>
            {currencies.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} — {currency.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="client-notes" label="Notes" error={error("notes")} hint="Only you see these.">
        <Textarea id="client-notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : client ? "Save client" : "Add client"}
        </Button>
      </div>
    </form>
  );
}
