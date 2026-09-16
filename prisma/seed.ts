import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Development data from the design handoff (all fictional). Safe to run repeatedly:
 * it only fills in the demo account when it doesn't exist yet.
 */
const DEMO_EMAIL = "demo@invoicemaker.test";
const DEMO_PASSWORD = "demo-password-123";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  if (await db.user.findUnique({ where: { email: DEMO_EMAIL } })) {
    console.log(`Demo account already exists: ${DEMO_EMAIL}`);
    return;
  }

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
          estimateNextNumber: 15,
        },
      },
    },
    include: { business: true },
  });
  const businessId = user.business!.id;

  await db.client.createMany({
    data: [
      { name: "Halcyon Labs", email: "ana@halcyon.co", phone: "+351 912 004 118", taxId: "PT509887412", address: "Rua do Século 44", city: "Lisbon", country: "PT" },
      { name: "Northwind Café", email: "maria@northwind.cafe", city: "Porto", country: "PT", currency: "EUR" },
      { name: "Mercado Vivo", email: "paulo@mercadovivo.br", city: "São Paulo", country: "BR" },
      { name: "Pine & Co.", email: "billing@pineco.com", address: "490 Alder St", city: "Portland", state: "OR", country: "US" },
      { name: "Vale Coffee", email: "ops@valecoffee.com", city: "Braga", country: "PT" },
    ].map((client) => ({ ...client, businessId })),
  });

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

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
