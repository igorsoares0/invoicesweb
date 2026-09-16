import Decimal from "decimal.js";

/** Isolated Decimal constructor: money rounds half-up, like accountants expect. */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Dec = InstanceType<typeof D>;

export type DiscountKind = "PERCENT" | "FIXED";

export interface LineInput {
  quantity: string;
  unitPrice: string | null;
  discountType: DiscountKind | null;
  discountValue: string | null;
  taxRate: string;
  taxExempt: boolean;
}

export interface Amounts {
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
}

const money = (value: Dec) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const toString = (value: Dec) => value.toFixed(2);

function lineAmounts(line: LineInput) {
  const subtotal = money(new D(line.quantity || 0).times(line.unitPrice ?? 0));
  let discount = new D(0);
  if (line.discountType && line.discountValue) {
    const value = new D(line.discountValue);
    discount = line.discountType === "PERCENT" ? money(subtotal.times(value).dividedBy(100)) : money(value);
    // A discount never turns a line negative.
    discount = D.min(discount, subtotal);
  }
  const net = subtotal.minus(discount);
  const tax = line.taxExempt ? new D(0) : money(net.times(line.taxRate || 0).dividedBy(100));
  return { subtotal, discount, tax, total: net.plus(tax) };
}

/**
 * One line: quantity × price, minus its discount, plus VAT on what's left.
 * Tax is rounded per line, so each printed line adds up on its own.
 */
export function calculateLine(line: LineInput): Amounts {
  const amounts = lineAmounts(line);
  return {
    subtotal: toString(amounts.subtotal),
    discount: toString(amounts.discount),
    tax: toString(amounts.tax),
    total: toString(amounts.total),
  };
}

/** Document totals are the sums of the rounded line amounts. */
export function calculateTotals(lines: LineInput[]): Amounts {
  const sum = { subtotal: new D(0), discount: new D(0), tax: new D(0), total: new D(0) };
  for (const line of lines) {
    const amounts = lineAmounts(line);
    sum.subtotal = sum.subtotal.plus(amounts.subtotal);
    sum.discount = sum.discount.plus(amounts.discount);
    sum.tax = sum.tax.plus(amounts.tax);
    sum.total = sum.total.plus(amounts.total);
  }
  return {
    subtotal: toString(sum.subtotal),
    discount: toString(sum.discount),
    tax: toString(sum.tax),
    total: toString(sum.total),
  };
}

export function subtractMoney(a: string, b: string): string {
  return toString(new D(a).minus(b));
}

export function addMoney(...values: string[]): string {
  return toString(values.reduce((sum, value) => sum.plus(value), new D(0)));
}

export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  return new D(a).comparedTo(b) as -1 | 0 | 1;
}

export function isZero(value: string): boolean {
  return new D(value).isZero();
}

/** Rounded share, e.g. 2000 of 4260 → 47. Never shows 100 until the whole amount is covered. */
export function percentOf(part: string, whole: string): number {
  if (new D(whole).isZero()) return 0;
  const share = new D(part).times(100).dividedBy(whole).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return new D(part).lessThan(whole) ? Math.min(share, 99) : share;
}
