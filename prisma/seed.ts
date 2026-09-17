import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { calculateLine, calculateTotals, subtractMoney, type LineInput } from "../src/lib/documents/math";

/**
 * Development data from the design handoff (all fictional). Recreates the demo account on every
 * run — it touches nothing else in the database.
 */
const DEMO_EMAIL = "demo@invoicemaker.test";
const DEMO_PASSWORD = "demo-password-123";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const today = new Date();
const day = (offset: number) => {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};
const at = (offset: number, hour = 10) => new Date(day(offset).getTime() + hour * 3_600_000);
const token = (prefix: "inv" | "est" = "inv") => {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  return `${prefix}_${[...randomBytes(20)].map((byte) => alphabet[byte & 31]).join("")}`;
};

type SeedLine = { description: string; quantity: string; unitPrice: string; discountPercent?: string; taxRate?: string };

function lineRows(lines: SeedLine[]) {
  return lines.map((line, position) => {
    const input: LineInput = {
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountType: line.discountPercent ? "PERCENT" : null,
      discountValue: line.discountPercent ?? null,
      taxRate: line.taxRate ?? "0",
      taxExempt: false,
    };
    return { position, description: line.description, ...input, ...calculateLine(input) };
  });
}

async function main() {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) await db.user.delete({ where: { id: existing.id } });

  const user = await db.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Ana Ribeiro",
      passwordHash: await hash(DEMO_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
      business: {
        create: {
          name: "Alvorada Studio",
          email: "hello@alvorada.studio",
          phone: "+351 912 887 004",
          taxId: "PT512334879",
          address: "Rua da Boavista 112",
          city: "Lisbon",
          postalCode: "1200-070",
          country: "PT",
          defaultCurrency: "USD",
          defaultTaxRate: "23",
          invoiceNextNumber: 45,
          estimateNextNumber: 16,
          timezone: "Europe/Lisbon",
          paymentInstructions: "Bank transfer — IBAN PT50 0002 0123 1234 5678 9015 4. Please reference the invoice number.",
        },
      },
    },
    include: { business: true },
  });
  const business = user.business!;
  const businessId = business.id;

  const clientData = [
    { name: "Halcyon Labs", email: "ana@halcyon.co", phone: "+351 912 004 118", taxId: "PT509887412", address: "Rua do Século 44", city: "Lisbon", country: "PT" },
    { name: "Northwind Café", email: "maria@northwind.cafe", city: "Porto", country: "PT", currency: "EUR" },
    { name: "Mercado Vivo", email: "paulo@mercadovivo.br", city: "São Paulo", country: "BR" },
    { name: "Pine & Co.", email: "billing@pineco.com", address: "490 Alder St", city: "Portland", state: "OR", postalCode: "97204", country: "US" },
    { name: "Vale Coffee", email: "ops@valecoffee.com", city: "Braga", country: "PT" },
  ];
  const clients: Record<string, Prisma.ClientGetPayload<object>> = {};
  for (const data of clientData) clients[data.name] = await db.client.create({ data: { ...data, businessId } });

  await db.product.createMany({
    data: [
      { name: "Design retainer — monthly", description: "Ongoing partnership, 40h/month", unit: "month", unitPrice: "5200", taxRate: "23" },
      { name: "UI design — per screen", description: "Hi-fi screen incl. one revision", unit: "screen", unitPrice: "320", taxRate: "23" },
      { name: "Discovery workshop", description: "Half-day remote + summary", unit: "session", unitPrice: "1400", taxRate: "23" },
      { name: "Handoff & QA support", description: "Dev support during build", unit: "hour", unitPrice: "140", taxRate: "0", taxExempt: true, taxExemptReason: "Art. 53 CIVA — small business exemption" },
      { name: "Brand sprint", description: "5-day identity sprint", unit: "project", unitPrice: "4260", taxRate: "23" },
      { name: "Motion pass", description: "Micro-interaction spec", unit: "hour", unitPrice: "160", taxRate: "23" },
    ].map((product) => ({ ...product, businessId })),
  });

  const issuer = {
    name: business.name, email: business.email, phone: business.phone, website: business.website, taxId: business.taxId,
    address: business.address, city: business.city, state: business.state, postalCode: business.postalCode,
    country: business.country, logoUrl: business.logoUrl, paymentInstructions: business.paymentInstructions,
  };

  async function invoice(options: {
    sequence: number;
    client: string;
    issued: number;
    due: number;
    currency?: string;
    lines: SeedLine[];
    sent?: boolean;
    /** How it was sent: by email (the default for sent invoices) or shared by hand. */
    emailed?: boolean;
    viewed?: number;
    payments?: { amount: string; on: number; method: "BANK_TRANSFER" | "CARD"; reference?: string }[];
  }) {
    const client = clients[options.client];
    const rows = lineRows(options.lines);
    const totals = calculateTotals(rows);
    const paid = (options.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2);
    const status = !options.sent
      ? "DRAFT"
      : Number(paid) >= Number(totals.total)
        ? "PAID"
        : Number(paid) > 0
          ? "PARTIALLY_PAID"
          : options.viewed !== undefined
            ? "VIEWED"
            : "SENT";
    const events: Prisma.InvoiceEventCreateWithoutInvoiceInput[] = [{ type: "CREATED", createdAt: at(options.issued, 9) }];
    const emailed = options.sent && options.emailed !== false && Boolean(client.email);
    if (options.sent) {
      events.push({
        type: "SENT",
        metadata: emailed ? { channel: "email", to: [client.email] } : { channel: "manual" },
        createdAt: at(options.issued, 17),
      });
    }
    if (options.viewed !== undefined) events.push({ type: "VIEWED", createdAt: at(options.viewed, 8) });
    for (const payment of options.payments ?? []) {
      events.push({ type: "PAYMENT_ADDED", metadata: { amount: payment.amount, method: payment.method }, createdAt: at(payment.on, 11) });
    }

    await db.invoice.create({
      data: {
        businessId,
        clientId: client.id,
        sequence: options.sequence,
        number: `INV-${String(options.sequence).padStart(4, "0")}`,
        status,
        issueDate: day(options.issued),
        dueDate: day(options.due),
        currency: options.currency ?? "USD",
        ...totals,
        amountPaid: paid,
        amountDue: options.sent ? subtractMoney(totals.total, paid) : totals.total,
        notes: "Thanks for the work this quarter.",
        publicToken: options.sent ? token() : null,
        sentAt: options.sent ? at(options.issued, 17) : null,
        viewedAt: options.viewed !== undefined ? at(options.viewed, 8) : null,
        issuerSnapshot: options.sent ? issuer : undefined,
        billToSnapshot: options.sent
          ? { name: client.name, email: client.email, phone: client.phone, company: client.company, taxId: client.taxId, address: client.address, city: client.city, state: client.state, postalCode: client.postalCode, country: client.country }
          : undefined,
        items: { create: rows },
        payments: {
          create: (options.payments ?? []).map((payment) => ({
            amount: payment.amount,
            currency: options.currency ?? "USD",
            paymentDate: day(payment.on),
            method: payment.method,
            reference: payment.reference,
            createdAt: at(payment.on, 11),
          })),
        },
        events: { create: events },
        emails: emailed
          ? {
              create: {
                businessId,
                type: "INVOICE",
                status: "SENT",
                recipient: client.email!,
                recipients: [client.email!],
                subject: `Invoice INV-${String(options.sequence).padStart(4, "0")} from ${business.name}`,
                attachedPdf: true,
                copyToSelf: true,
                providerId: `seed_${options.sequence}`,
                sentAt: at(options.issued, 17),
                createdAt: at(options.issued, 17),
              },
            }
          : undefined,
        createdAt: at(options.issued, 9),
      },
    });
  }

  await invoice({ sequence: 39, client: "Halcyon Labs", issued: -43, due: -29, sent: true, viewed: -42, lines: [{ description: "Discovery workshop", quantity: "2", unitPrice: "1900" }], payments: [{ amount: "3800.00", on: -32, method: "BANK_TRANSFER", reference: "TRF-88120" }] });
  await invoice({ sequence: 40, client: "Mercado Vivo", issued: -27, due: 4, sent: true, viewed: -25, lines: [{ description: "Brand sprint", quantity: "1", unitPrice: "4260" }], payments: [{ amount: "2000.00", on: -19, method: "BANK_TRANSFER", reference: "TRF-99413" }] });
  await invoice({ sequence: 41, client: "Northwind Café", issued: -23, due: -16, currency: "EUR", sent: true, emailed: false, lines: [{ description: "Menu system", quantity: "1", unitPrice: "1980" }] });
  await invoice({ sequence: 42, client: "Halcyon Labs", issued: -2, due: 12, sent: true, lines: [{ description: "Design retainer — monthly", quantity: "1", unitPrice: "5200", taxRate: "23" }] });
  await invoice({ sequence: 43, client: "Vale Coffee", issued: -9, due: -2, sent: true, viewed: -8, lines: [{ description: "Motion pass", quantity: "8", unitPrice: "160", taxRate: "23" }] });
  await invoice({
    sequence: 44,
    client: "Pine & Co.",
    issued: 0,
    due: 14,
    lines: [
      { description: "Website redesign — discovery & IA", quantity: "1", unitPrice: "2400" },
      { description: "UI design — 12 screens", quantity: "12", unitPrice: "320" },
      { description: "Handoff & QA support", quantity: "6", unitPrice: "140", discountPercent: "10" },
    ],
  });

  async function estimate(options: {
    sequence: number;
    client?: string;
    issued: number;
    expires: number;
    lines: SeedLine[];
    terms?: string;
    status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED" | "CONVERTED";
    viewed?: number;
    replied?: number;
    convertedInvoice?: number;
  }) {
    const client = options.client ? clients[options.client] : null;
    const rows = lineRows(options.lines);
    const sent = options.status !== "DRAFT";
    const events: Prisma.EstimateEventCreateWithoutEstimateInput[] = [{ type: "CREATED", createdAt: at(options.issued, 9) }];
    const emailed = sent && Boolean(client?.email);
    if (sent) {
      events.push({
        type: "SENT",
        metadata: emailed ? { channel: "email", to: [client!.email] } : { channel: "manual" },
        createdAt: at(options.issued, 11),
      });
    }
    if (options.viewed !== undefined) events.push({ type: "VIEWED", createdAt: at(options.viewed, 18) });
    if (options.replied !== undefined) {
      const accepted = options.status === "ACCEPTED" || options.status === "CONVERTED";
      events.push({ type: accepted ? "ACCEPTED" : "DECLINED", metadata: { by: "client" }, createdAt: at(options.replied, 9) });
    }
    const convertedInvoice = options.convertedInvoice
      ? await db.invoice.findUniqueOrThrow({ where: { businessId_sequence: { businessId, sequence: options.convertedInvoice } } })
      : null;
    if (convertedInvoice) {
      events.push({ type: "CONVERTED", metadata: { invoiceId: convertedInvoice.id, invoiceNumber: convertedInvoice.number }, createdAt: at(options.replied!, 12) });
    }

    await db.estimate.create({
      data: {
        businessId,
        clientId: client?.id ?? null,
        sequence: options.sequence,
        number: `EST-${String(options.sequence).padStart(4, "0")}`,
        status: options.status,
        issueDate: day(options.issued),
        expiryDate: day(options.expires),
        currency: "USD",
        ...calculateTotals(rows),
        terms: options.terms ?? null,
        publicToken: sent && options.status !== "CONVERTED" ? token("est") : null,
        sentAt: sent ? at(options.issued, 11) : null,
        viewedAt: options.viewed !== undefined ? at(options.viewed, 18) : null,
        acceptedAt: options.replied !== undefined && options.status !== "DECLINED" ? at(options.replied, 9) : null,
        declinedAt: options.status === "DECLINED" ? at(options.replied!, 9) : null,
        respondedBy: options.replied !== undefined ? "client" : null,
        convertedAt: convertedInvoice ? at(options.replied!, 12) : null,
        convertedInvoiceId: convertedInvoice?.id ?? null,
        issuerSnapshot: sent ? issuer : undefined,
        billToSnapshot:
          sent && client
            ? { name: client.name, email: client.email, phone: client.phone, company: client.company, taxId: client.taxId, address: client.address, city: client.city, state: client.state, postalCode: client.postalCode, country: client.country }
            : undefined,
        items: { create: rows },
        events: { create: events },
        emails: emailed
          ? {
              create: {
                businessId,
                type: "ESTIMATE",
                status: "SENT",
                recipient: client!.email!,
                recipients: [client!.email!],
                subject: `Estimate EST-${String(options.sequence).padStart(4, "0")} from ${business.name}`,
                attachedPdf: true,
                copyToSelf: true,
                providerId: `seed_est_${options.sequence}`,
                sentAt: at(options.issued, 11),
                createdAt: at(options.issued, 11),
              },
            }
          : undefined,
        createdAt: at(options.issued, 9),
      },
    });
  }

  const scope = "Valid for 14 days. 50% due on kickoff, balance on delivery. Two revision rounds included per screen.";
  await estimate({ sequence: 10, client: "Northwind Café", issued: -19, expires: -5, status: "DECLINED", viewed: -18, replied: -12, lines: [{ description: "Signage package", quantity: "1", unitPrice: "2480" }] });
  await estimate({ sequence: 11, client: "Halcyon Labs", issued: -15, expires: -1, status: "CONVERTED", viewed: -14, replied: -3, convertedInvoice: 42, lines: [{ description: "Design retainer — monthly", quantity: "1", unitPrice: "5200", taxRate: "23" }] });
  await estimate({ sequence: 12, client: "Vale Coffee", issued: -35, expires: -21, status: "SENT", lines: [{ description: "Motion identity", quantity: "1", unitPrice: "5400" }] });
  await estimate({ sequence: 13, client: "Vale Coffee", issued: -11, expires: 3, status: "VIEWED", viewed: -9, terms: scope, lines: [{ description: "Packaging refresh", quantity: "1", unitPrice: "3150" }] });
  await estimate({
    sequence: 14,
    client: "Pine & Co.",
    issued: -8,
    expires: 6,
    status: "ACCEPTED",
    viewed: -7,
    replied: -2,
    terms: scope,
    lines: [
      { description: "Website redesign — discovery & IA", quantity: "1", unitPrice: "2400" },
      { description: "UI design — 12 screens", quantity: "12", unitPrice: "320" },
      { description: "Handoff & QA support", quantity: "6", unitPrice: "140", discountPercent: "10" },
    ],
  });
  await estimate({ sequence: 15, issued: 0, expires: 14, status: "DRAFT", lines: [] });

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
