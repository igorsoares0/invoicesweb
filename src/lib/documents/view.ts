import { daysBetween, formatLongDate, type IsoDate } from "@/lib/dates";
import { compareMoney, isZero } from "@/lib/documents/math";
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

export type DocumentKind = "invoice" | "estimate";

export interface DocumentViewInput {
  kind?: DocumentKind;
  number: string;
  currency: string;
  issueDate: IsoDate;
  /** Due date for invoices, expiry date for estimates. */
  endDate: IsoDate;
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
  /** Prints "Made with Invoice Maker" (documents from the Free plan). */
  branded?: boolean;
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
export interface DocumentLabels {
  title: string;
  numberLabel: string;
  amount: string;
  /** Short label for the end date: "Due" / "Valid until". */
  end: string;
  endDate: string;
  /** Word before the end date in running text: "by" / "valid until". */
  endPrefix: string;
  billTo: string;
  grandTotal: string;
}

const LABELS: Record<DocumentKind, DocumentLabels> = {
  invoice: {
    title: "Invoice",
    numberLabel: "Invoice no.",
    amount: "Amount due",
    end: "Due",
    endDate: "Due date",
    endPrefix: "by",
    billTo: "Bill to",
    grandTotal: "Total due",
  },
  estimate: {
    title: "Estimate",
    numberLabel: "Estimate no.",
    amount: "Estimate total",
    end: "Valid until",
    endDate: "Valid until",
    endPrefix: "valid until",
    billTo: "Prepared for",
    grandTotal: "Total",
  },
};

export interface DocumentView {
  kind: DocumentKind;
  labels: DocumentLabels;
  number: string;
  currency: string;
  issued: string;
  /** Formatted due date (invoices) or expiry date (estimates). */
  end: string;
  /** "Net 14", "Due on receipt" or, for estimates, "Valid for 14 days" */
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
  branded: boolean;
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

export function buildDocumentView(input: DocumentViewInput): DocumentView {
  const kind = input.kind ?? "invoice";
  const money = (value: string) => formatMoney(value, input.currency);
  const termDays = daysBetween(input.issueDate, input.endDate);
  const termsLabel =
    kind === "estimate"
      ? `Valid for ${Math.max(termDays, 0)} day${termDays === 1 ? "" : "s"}`
      : termDays <= 0
        ? "Due on receipt"
        : `Net ${termDays}`;
  return {
    kind,
    labels: LABELS[kind],
    number: input.number,
    currency: input.currency,
    issued: formatLongDate(input.issueDate),
    end: formatLongDate(input.endDate),
    termsLabel,
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
      // Estimates aren't paid; their headline amount is simply the total.
      amountPaid: kind === "invoice" && compareMoney(input.amountPaid, "0") > 0 ? money(input.amountPaid) : null,
      amountDue: money(kind === "invoice" ? input.amountDue : input.total),
    },
    exemptions: [
      ...new Set(
        input.lines
          .filter((line) => line.taxExempt && line.taxExemptReason)
          .map((line) => `VAT exempt — ${line.taxExemptReason}`),
      ),
    ],
    // How to pay belongs on invoices; an estimate asks for a decision, not money.
    paymentInstructions: kind === "invoice" ? (input.issuer.paymentInstructions ?? null) : null,
    notes: input.notes,
    terms: input.terms,
    accent: input.color,
    branded: input.branded ?? false,
  };
}

