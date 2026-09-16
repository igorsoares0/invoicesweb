import { config as loadEnv } from "dotenv";
import { execSync } from "node:child_process";
import pg from "pg";

export default async function globalSetup() {
  loadEnv({ quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/\/\w+_test(\?|$)/.test(url)) {
    throw new Error("DATABASE_URL_TEST must point at a database whose name ends in _test.");
  }

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(
    'TRUNCATE TABLE "InvoiceEvent", "Payment", "InvoiceItem", "Invoice", "Product", "Client", "Business", "Account", "Session", "VerificationToken", "User" CASCADE',
  );
  await client.end();
}
