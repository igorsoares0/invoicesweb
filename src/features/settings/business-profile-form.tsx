"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/forms/error-banner";
import { errorProps, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api-client";
import type { BusinessDto } from "@/lib/api-types";
import { countryOptions } from "@/lib/countries";
import { SettingsCard } from "./settings-card";

const countries = countryOptions();
const FIELDS = ["name", "taxId", "email", "phone", "website", "address", "city", "state", "postalCode", "country"] as const;

export function BusinessProfileForm({ business }: { business: BusinessDto }) {
  const router = useRouter();
  const { error, pending, submit } = useApiForm();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(FIELDS.map((field) => [field, String(form.get(field) ?? "")]));
    if (await submit(() => api.patch<BusinessDto>("/business", body))) {
      toast.success("Business profile saved");
      router.refresh();
    }
  }

  const text = (id: (typeof FIELDS)[number], label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field id={`business-${id}`} label={label} error={error(id)}>
      <Input
        id={`business-${id}`}
        name={id}
        defaultValue={business[id] ?? ""}
        {...props}
        {...errorProps(`business-${id}`, error(id))}
      />
    </Field>
  );

  return (
    <SettingsCard
      id="profile"
      title="Business profile"
      description="This is what your clients see on every invoice and estimate."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error("_form") ? <ErrorBanner>{error("_form")}</ErrorBanner> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Business name", { autoComplete: "organization" })}
          {text("taxId", "Tax ID / VAT")}
          {text("email", "Email", { type: "email" })}
          {text("phone", "Phone", { type: "tel" })}
          <div className="sm:col-span-2">{text("website", "Website", { placeholder: "alvorada.studio" })}</div>
          <div className="sm:col-span-2">{text("address", "Address")}</div>
          {text("city", "City")}
          {text("state", "State / region")}
          {text("postalCode", "Postal code")}
          <Field id="business-country" label="Country" error={error("country")}>
            <NativeSelect id="business-country" name="country" defaultValue={business.country ?? ""}>
              <option value="">—</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Logo upload arrives with the PDF templates. It will print top-left on every template.
        </p>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
