/** `?product=new` opens the editor for a new item. */
export const NEW_PRODUCT = "new";

/** "month" → "per month"; values that already start with "per" are kept. */
export function formatUnit(unit: string | null): string {
  if (!unit) return "—";
  return /^per\s/i.test(unit) ? unit : `per ${unit}`;
}
