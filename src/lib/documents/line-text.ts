import { formatMoney, formatPercent, formatQuantity, MONEY_PATTERN, normalizeDecimal } from "@/lib/money";
import { calculateLine, isZero, type LineInput } from "./math";

/** "$140.00" → "$140", but "$140.50" stays. */
function compactMoney(amount: string, currency: string) {
  return formatMoney(amount, currency).replace(/[.,]00(?=\D*$)/, "");
}

/**
 * Spells out a line's arithmetic ("6 × $140 − 10% = $756.00 · no VAT"). The server owns the
 * calculation; showing the math lets the user check it before sending.
 */
export function describeLineMath(line: LineInput, currency: string): string {
  if (line.unitPrice === null) return "Add a price to see the line total";
  const amounts = calculateLine(line);
  const parts = [`${formatQuantity(line.quantity)} × ${compactMoney(line.unitPrice, currency)}`];
  if (line.discountType && line.discountValue && !isZero(line.discountValue)) {
    parts.push(
      line.discountType === "PERCENT"
        ? `− ${formatPercent(line.discountValue)}`
        : `− ${formatMoney(line.discountValue, currency)}`,
    );
  }
  const net = formatMoney((Number(amounts.subtotal) - Number(amounts.discount)).toFixed(2), currency);
  const tax = line.taxExempt || isZero(line.taxRate) ? "no VAT" : `+ ${formatPercent(line.taxRate)} VAT ${formatMoney(amounts.tax, currency)}`;
  return `${parts.join(" ")} = ${net} · ${tax}`;
}

/** Accepts what people type in money fields: "2,400", "2400.5", "$ 140". Null when it isn't a number. */
export function parseMoneyInput(value: string): string | null {
  const cleaned = value.replace(/[\s$€£,]/g, "");
  if (cleaned === "") return null;
  return MONEY_PATTERN.test(cleaned) ? normalizeDecimal(cleaned) : null;
}
