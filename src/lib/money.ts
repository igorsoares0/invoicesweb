/** Decimal amounts travel as strings ("1234.50") so no value ever passes through a float. */
export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
export const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

/** Pads a validated decimal string to exactly two fraction digits: "12.5" → "12.50". */
export function normalizeDecimal(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const trimmedWhole = whole.replace(/^0+(?=\d)/, "");
  return `${trimmedWhole}.${fraction.padEnd(2, "0")}`;
}

/**
 * Formats a decimal string as currency without converting the whole amount to a float:
 * the integer part is grouped by Intl via BigInt, the fraction is appended as-is.
 */
export function formatMoney(amount: string, currency: string, locale = "en-US"): string {
  const [whole, fraction = "00"] = normalizeDecimal(amount).split(".");
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 });
  return formatter
    .formatToParts(BigInt(whole))
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}

/** "23.00" → "23%", "6.50" → "6.5%". */
export function formatPercent(value: string): string {
  const normalized = normalizeDecimal(value).replace(/\.?0+$/, "");
  return `${normalized}%`;
}

/** Grouped number without a currency sign: "2400.5" → "2,400.50". */
export function formatAmount(amount: string, locale = "en-US"): string {
  const [whole, fraction] = normalizeDecimal(amount).split(".");
  const grouped = new Intl.NumberFormat(locale).format(BigInt(whole));
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  return `${grouped}${separator}${fraction}`;
}

/** "1.500" → "1.5", "12" → "12". */
export function formatQuantity(quantity: string): string {
  return quantity.includes(".") ? quantity.replace(/\.?0+$/, "") : quantity;
}
