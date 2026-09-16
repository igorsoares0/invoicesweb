import { z } from "zod";
import { isCountryCode } from "@/lib/countries";
import { isCurrencyCode } from "@/lib/currencies";
import { MONEY_PATTERN, normalizeDecimal, PERCENT_PATTERN } from "@/lib/money";

/**
 * Optional free text. `undefined` means "leave unchanged"; an empty string is stored as `null`
 * so clearing a field in a form actually clears it.
 */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const requiredText = (max: number, label = "This field") =>
  z.string().trim().min(1, `${label} is required`).max(max, `Must be at most ${max} characters`);

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.union([z.literal("").transform(() => null), z.email("Enter a valid email address")]))
  .nullable()
  .optional();

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCurrencyCode, "Choose a valid ISO 4217 currency");

export const optionalCurrencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.union([z.literal("").transform(() => null), currencyCode]))
  .nullable()
  .optional();

export const optionalCountryCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.union([
      z.literal("").transform(() => null),
      z.string().refine(isCountryCode, "Choose a valid country"),
    ]),
  )
  .nullable()
  .optional();

const decimalInput = z.union([z.string().trim(), z.number().transform((value) => String(value))]);

/** Non-negative amount with at most two decimals, returned as a normalized string. */
export const moneyAmount = decimalInput
  .refine((value) => MONEY_PATTERN.test(value), "Enter an amount like 1200 or 1200.50")
  .transform(normalizeDecimal);

/** Percentage between 0 and 100 with at most two decimals, returned as a normalized string. */
export const percentage = decimalInput
  .refine((value) => PERCENT_PATTERN.test(value) && Number(value) <= 100, "Enter a rate between 0 and 100")
  .transform(normalizeDecimal);

export const resourceId = z.cuid();

export type SortOrder = "asc" | "desc";

/** Query schema for list endpoints: pagination, free-text search and a whitelisted sort field. */
export function listQuery<const TSort extends readonly [string, ...string[]]>(
  sortFields: TSort,
  defaults: { sort: TSort[number]; order: SortOrder },
) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z
      .string()
      .trim()
      .max(100)
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    sort: z.enum(sortFields).default(defaults.sort as never),
    order: z.enum(["asc", "desc"]).default(defaults.order),
  });
}
