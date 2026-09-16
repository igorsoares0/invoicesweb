import { z } from "zod";
import {
  currencyCode,
  optionalCountryCode,
  optionalEmail,
  optionalText,
  percentage,
  requiredText,
} from "./common";

const documentPrefix = z
  .string()
  .max(12, "Use at most 12 characters")
  .regex(/^[A-Za-z0-9\-_/#.]*$/, "Use letters, digits and - _ / # . only");

const sequenceNumber = z.coerce
  .number({ error: "Enter a whole number" })
  .int("Enter a whole number")
  .min(1, "Must be 1 or more")
  .max(99_999_999, "Number is too large");

const timezone = z
  .string()
  .refine((value) => value === "UTC" || Intl.supportedValuesOf("timeZone").includes(value), "Choose a valid time zone");

export const SUPPORTED_LANGUAGES = ["en"] as const;

export const createBusinessSchema = z.object({
  name: requiredText(120, "Business name"),
  country: optionalCountryCode,
  defaultCurrency: currencyCode.default("USD"),
});

export const updateBusinessSchema = z
  .object({
    name: requiredText(120, "Business name"),
    email: optionalEmail,
    phone: optionalText(50),
    website: optionalText(200),
    taxId: optionalText(50),
    address: optionalText(500),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalCountryCode,
    postalCode: optionalText(20),
    defaultCurrency: currencyCode,
    defaultLanguage: z.enum(SUPPORTED_LANGUAGES),
    defaultTaxRate: percentage.nullable(),
    paymentTermsDays: z.coerce.number().int().min(0, "Must be 0 or more").max(365, "Use at most 365 days"),
    timezone,
    invoicePrefix: documentPrefix,
    invoiceNextNumber: sequenceNumber,
    estimatePrefix: documentPrefix,
    estimateNextNumber: sequenceNumber,
    paymentInstructions: optionalText(1000),
    estimateValidityDays: z.coerce.number().int("Enter a whole number").min(1, "Must be 1 or more").max(365, "Use at most 365 days"),
  })
  .partial();

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
