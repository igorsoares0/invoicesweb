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
  paymentInstructions: string | null;
  estimateValidityDays: number;
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

export type InvoiceStatus = "DRAFT" | "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type DisplayInvoiceStatus = InvoiceStatus | "OVERDUE";
export type DocumentTemplate = "MODERN" | "CLASSIC" | "MINIMAL" | "PROFESSIONAL" | "BOLD";
export type PaymentMethod = "BANK_TRANSFER" | "CARD" | "CASH" | "PAYPAL" | "OTHER";
export type InvoiceEventType =
  | "ACCEPTED"
  | "DECLINED"
  | "REOPENED"
  | "CONVERTED"
  | "CREATED"
  | "UPDATED"
  | "SENT"
  | "VIEWED"
  | "PAYMENT_ADDED"
  | "PAYMENT_REMOVED"
  | "CANCELLED"
  | "LINK_REVOKED"
  | "DUPLICATED";

export interface InvoiceItemDto {
  id: string;
  productId: string | null;
  position: number;
  description: string;
  quantity: string;
  unitPrice: string | null;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: string | null;
  taxRate: string;
  taxExempt: boolean;
  taxExemptReason: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
}

export interface PaymentDto {
  id: string;
  amount: string;
  currency: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InvoiceEventDto {
  id: string;
  type: InvoiceEventType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface InvoiceIssueDto {
  path: string;
  summary: string;
  fix: string;
  message: string;
}

export interface InvoiceClientDto {
  id: string;
  name: string;
  email: string | null;
  deleted: boolean;
}

export interface InvoiceListItemDto {
  id: string;
  number: string;
  status: InvoiceStatus;
  displayStatus: DisplayInvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: string;
  amountDue: string;
  client: { id: string; name: string } | null;
  /** First line's description, for the "Client · Description" column. */
  summary: string | null;
  createdAt: string;
}

export interface InvoiceDto extends Omit<InvoiceListItemDto, "client" | "summary"> {
  sequence: number;
  client: InvoiceClientDto | null;
  subtotal: string;
  discount: string;
  tax: string;
  amountPaid: string;
  notes: string | null;
  terms: string | null;
  template: DocumentTemplate;
  color: string;
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  cancelledAt: string | null;
  items: InvoiceItemDto[];
  payments: PaymentDto[];
  events: InvoiceEventDto[];
  /** What blocks sending and the PDF; empty when ready. */
  issues: InvoiceIssueDto[];
  /** The estimate this invoice was converted from. */
  fromEstimate: { id: string; number: string } | null;
  updatedAt: string;
}

export interface DashboardDto {
  currency: string;
  /** Other currencies with invoices; each is reported on its own, never converted. */
  otherCurrencies: string[];
  paidThisMonth: { amount: string; previousMonth: string };
  outstanding: { amount: string; count: number };
  overdue: { amount: string; count: number; oldestDays: number | null };
  averageDaysToPay: number | null;
}

export type EstimateStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED" | "CONVERTED";
export type DisplayEstimateStatus = EstimateStatus | "EXPIRED";

export interface EstimateListItemDto {
  id: string;
  number: string;
  status: EstimateStatus;
  displayStatus: DisplayEstimateStatus;
  issueDate: string;
  expiryDate: string;
  currency: string;
  total: string;
  client: { id: string; name: string } | null;
  summary: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface EstimateDto extends Omit<EstimateListItemDto, "client" | "summary"> {
  sequence: number;
  client: InvoiceClientDto | null;
  subtotal: string;
  discount: string;
  tax: string;
  notes: string | null;
  terms: string | null;
  template: DocumentTemplate;
  color: string;
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  declinedAt: string | null;
  convertedAt: string | null;
  respondedBy: "client" | "you" | null;
  convertedInvoice: { id: string; number: string } | null;
  items: InvoiceItemDto[];
  events: InvoiceEventDto[];
  issues: InvoiceIssueDto[];
  updatedAt: string;
}

export interface EstimateSummaryDto {
  currency: string;
  otherCurrencies: string[];
  awaitingReply: { amount: string; count: number };
  acceptedNotInvoiced: { amount: string; count: number };
  wonThisQuarter: { percent: number | null; accepted: number; decided: number };
  averageReplyDays: number | null;
  /** The oldest accepted estimate that hasn't become an invoice yet, for the reminder strip. */
  readyToConvert: { id: string; number: string; clientName: string | null; acceptedAt: string } | null;
}

export interface ConvertEstimateResultDto {
  invoice: InvoiceDto;
  estimate: EstimateDto;
}
