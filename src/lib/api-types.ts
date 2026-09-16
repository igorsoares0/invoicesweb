/** Wire types returned by /api/v1. Dates are ISO strings; decimals are strings with two fraction digits. */

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiList<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, string[]> };
}

export type Plan = "FREE" | "PRO";

export interface UserDto {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface BusinessDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  defaultCurrency: string;
  defaultLanguage: string;
  defaultTaxRate: string | null;
  paymentTermsDays: number;
  timezone: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  estimatePrefix: string;
  estimateNextNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: string;
  currency: string | null;
  taxRate: string;
  taxExempt: boolean;
  taxExemptReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Entitlements {
  plan: Plan;
  limits: { invoicesPerMonth: number | null; openEstimates: number | null };
  features: {
    templates: string[];
    canUseCustomBranding: boolean;
    canSendReminders: boolean;
    canExportCsv: boolean;
  };
}

export interface MeDto {
  user: UserDto;
  business: BusinessDto | null;
  subscription: { plan: Plan; status: "ACTIVE" };
  entitlements: Entitlements;
}
