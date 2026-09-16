import { daysBetween, formatLongDate, type IsoDate } from "@/lib/dates";
import { compareMoney, isZero } from "@/lib/invoices/math";
import { formatAmount, formatMoney, formatPercent, formatQuantity } from "@/lib/money";

export interface PartyInput {
  name: string;
  email: string | null;
  phone?: string | null;
  website?: string | null;
  company?: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl?: string | null;
  paymentInstructions?: string | null;
}

export interface DocumentLineInput {
  description: string;
  quantity: string;
  unitPrice: string | null;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: string | null;
  taxRate: string;
  taxExempt: boolean;
  taxExemptReason: string | null;
  total: string;
}

export interface InvoiceViewInput {
  number: string;
  currency: string;
  issueDate: IsoDate;
  dueDate: IsoDate;
  issuer: PartyInput;
  billTo: PartyInput | null;
  lines: DocumentLineInput[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  terms: string | null;
  color: string;
}

export interface DocumentParty {
  name: string;
  initial: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  company: string | null;
  taxId: string | null;
  /** "Rua da Boavista 112, Lisbon 1200-070, Portugal" */
  address: string | null;
  /** "Lisbon, PT" */
  locality: string | null;
  logoUrl: string | null;
}

export interface DocumentLine {
  description: string;
  quantity: string;
  rate: string | null;
  /** "10%" or "$50.00 off" */
  adjustment: string | null;
  amount: string;
  /** The amount with its currency sign, for layouts without a currency column. */
  amountMoney: string;
  exempt: boolean;
}

/**
 * Everything a template prints, already formatted. Built once and handed to the editor
 * preview, the public page and the PDF, so all three always agree.
 */
export interface InvoiceView {
  number: string;
  currency: string;
  issued: string;
  due: string;
  /** "Net 14" or "Due on receipt" */
  termsLabel: string;
  issuer: DocumentParty;
  billTo: DocumentParty | null;
  lines: DocumentLine[];
  totals: {
    subtotal: string;
    discount: string | null;
    taxLabel: string;
    tax: string;
    total: string;
    amountPaid: string | null;
    amountDue: string;
  };
  exemptions: string[];
  paymentInstructions: string | null;
  notes: string | null;
  terms: string | null;
  accent: string;
}

function party(input: PartyInput): DocumentParty {
  const cityLine = [input.city, input.state, input.postalCode].filter(Boolean).join(" ");
  // Country as its ISO code keeps the address on one line, as in the design ("Lisbon, PT").
  const address = [input.address, cityLine, input.country].filter(Boolean).join(", ");
  const locality = [input.city, input.country].filter(Boolean).join(", ");
  return {
    name: input.name,
    initial: input.name.trim().slice(0, 1).toUpperCase() || "·",
    email: input.email,
    phone: input.phone ?? null,
    website: input.website ?? null,
    company: input.company ?? null,
    taxId: input.taxId,
    address: address || null,
    locality: locality || null,
    logoUrl: input.logoUrl ?? null,
  };
}

function taxLabel(lines: DocumentLineInput[]): string {
  const taxed = lines.filter((line) => !line.taxExempt);
  if (taxed.length === 0) return lines.length ? "VAT (exempt)" : "VAT";
  const rates = new Set(taxed.map((line) => Number(line.taxRate)));
  return rates.size === 1 ? `VAT (${formatPercent(taxed[0].taxRate)})` : "VAT";
}

export function buildInvoiceView(input: InvoiceViewInput): InvoiceView {
  const money = (value: string) => formatMoney(value, input.currency);
  const termDays = daysBetween(input.issueDate, input.dueDate);
  return {
    number: input.number,
    currency: input.currency,
    issued: formatLongDate(input.issueDate),
    due: formatLongDate(input.dueDate),
    termsLabel: termDays <= 0 ? "Due on receipt" : `Net ${termDays}`,
    issuer: party(input.issuer),
    billTo: input.billTo ? party(input.billTo) : null,
    lines: input.lines.map((line) => ({
      description: line.description,
      quantity: formatQuantity(line.quantity),
      rate: line.unitPrice === null ? null : formatAmount(line.unitPrice),
      adjustment:
        line.discountType && line.discountValue && !isZero(line.discountValue)
          ? line.discountType === "PERCENT"
            ? formatPercent(line.discountValue)
            : `${money(line.discountValue)} off`
          : null,
      amount: formatAmount(line.total),
      amountMoney: money(line.total),
      exempt: line.taxExempt,
    })),
    totals: {
      subtotal: money(input.subtotal),
      discount: isZero(input.discount) ? null : `−${money(input.discount)}`,
      taxLabel: taxLabel(input.lines),
      tax: money(input.tax),
      total: money(input.total),
      amountPaid: compareMoney(input.amountPaid, "0") > 0 ? money(input.amountPaid) : null,
      amountDue: money(input.amountDue),
    },
    exemptions: [
      ...new Set(
        input.lines
          .filter((line) => line.taxExempt && line.taxExemptReason)
          .map((line) => `VAT exempt — ${line.taxExemptReason}`),
      ),
    ],
    paymentInstructions: input.issuer.paymentInstructions ?? null,
    notes: input.notes,
    terms: input.terms,
    accent: input.color,
  };
}
