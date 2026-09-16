/** Shown first in currency pickers; every other ISO 4217 code follows alphabetically. */
export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "BRL", "CAD", "AUD", "CHF", "JPY"] as const;

const ALL_CURRENCIES: readonly string[] = Intl.supportedValuesOf("currency");
const currencySet = new Set([...ALL_CURRENCIES, ...COMMON_CURRENCIES]);

export function isCurrencyCode(value: string): boolean {
  return currencySet.has(value);
}

export function currencyOptions(locale = "en") {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  const common = new Set<string>(COMMON_CURRENCIES);
  const rest = ALL_CURRENCIES.filter((code) => !common.has(code));
  return [...COMMON_CURRENCIES, ...rest].map((code) => ({ code, name: names.of(code) ?? code }));
}

export function currencySymbol(code: string, locale = "en"): string {
  const part = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? code;
}
