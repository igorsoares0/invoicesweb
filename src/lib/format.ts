import { countryName } from "./countries";

export function formatMonthYear(iso: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(new Date(iso));
}

/** One-line postal address, skipping empty parts: "Rua do Século 44, Lisbon 1200-433, Portugal". */
export function formatAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  const cityLine = [parts.city, parts.state, parts.postalCode].filter(Boolean).join(" ");
  return [parts.address, cityLine, parts.country ? countryName(parts.country) : null].filter(Boolean).join(", ");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
