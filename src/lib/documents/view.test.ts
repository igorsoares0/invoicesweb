import { describe, expect, it } from "vitest";
import { buildInvoiceView, type InvoiceViewInput } from "./view";

const input: InvoiceViewInput = {
  number: "INV-0044",
  currency: "USD",
  issueDate: "2026-09-12",
  dueDate: "2026-09-26",
  issuer: {
    name: "Alvorada Studio",
    email: "hello@alvorada.studio",
    taxId: "PT512334879",
    address: "Rua da Boavista 112",
    city: "Lisbon",
    state: null,
    postalCode: "1200-070",
    country: "PT",
    paymentInstructions: "Bank transfer — IBAN PT50 0002 0123 1234 5678 9015 4.",
  },
  billTo: {
    name: "Pine & Co.",
    email: "billing@pineco.com",
    taxId: null,
    address: "490 Alder St",
    city: "Portland",
    state: "OR",
    postalCode: "97204",
    country: "US",
  },
  lines: [
    { description: "Website redesign", quantity: "1", unitPrice: "2400.00", discountType: null, discountValue: null, taxRate: "0.00", taxExempt: false, taxExemptReason: null, total: "2400.00" },
    { description: "Handoff & QA support", quantity: "6.000", unitPrice: "140.00", discountType: "PERCENT", discountValue: "10.00", taxRate: "0.00", taxExempt: true, taxExemptReason: "Art. 53 CIVA", total: "756.00" },
  ],
  subtotal: "3240.00",
  discount: "84.00",
  tax: "0.00",
  total: "3156.00",
  amountPaid: "0.00",
  amountDue: "3156.00",
  notes: "Thanks!",
  terms: null,
  color: "#1e40af",
};

describe("buildInvoiceView", () => {
  it("formats dates, terms, parties and money for printing", () => {
    const view = buildInvoiceView(input);
    expect(view).toMatchObject({
      issued: "September 12, 2026",
      due: "September 26, 2026",
      termsLabel: "Net 14",
      paymentInstructions: "Bank transfer — IBAN PT50 0002 0123 1234 5678 9015 4.",
    });
    expect(view.issuer).toMatchObject({ initial: "A", locality: "Lisbon, PT" });
    expect(view.billTo?.address).toBe("490 Alder St, Portland OR 97204, US");
    expect(view.totals).toEqual({
      subtotal: "$3,240.00",
      discount: "−$84.00",
      taxLabel: "VAT (0%)",
      tax: "$0.00",
      total: "$3,156.00",
      amountPaid: null,
      amountDue: "$3,156.00",
    });
  });

  it("formats lines with adjustments and lists exemption reasons once", () => {
    const view = buildInvoiceView({ ...input, lines: [...input.lines, { ...input.lines[1], description: "More QA" }] });
    expect(view.lines[1]).toEqual({
      description: "Handoff & QA support",
      quantity: "6",
      rate: "140.00",
      adjustment: "10%",
      amount: "756.00",
      amountMoney: "$756.00",
      exempt: true,
    });
    expect(view.exemptions).toEqual(["VAT exempt — Art. 53 CIVA"]);
  });

  it("handles fixed discounts, missing prices, payments and same-day terms", () => {
    const view = buildInvoiceView({
      ...input,
      dueDate: "2026-09-12",
      amountPaid: "1000.00",
      amountDue: "2156.00",
      lines: [{ ...input.lines[0], unitPrice: null, discountType: "FIXED", discountValue: "50.00", taxRate: "23.00" }],
      billTo: null,
    });
    expect(view.termsLabel).toBe("Due on receipt");
    expect(view.lines[0]).toMatchObject({ rate: null, adjustment: "$50.00 off" });
    expect(view.totals).toMatchObject({ amountPaid: "$1,000.00", amountDue: "$2,156.00", taxLabel: "VAT (23%)" });
    expect(view.billTo).toBeNull();
  });

  it("labels mixed VAT rates generically", () => {
    const view = buildInvoiceView({
      ...input,
      lines: [
        { ...input.lines[0], taxRate: "23.00" },
        { ...input.lines[0], taxRate: "6.00" },
      ],
    });
    expect(view.totals.taxLabel).toBe("VAT");
  });
});
