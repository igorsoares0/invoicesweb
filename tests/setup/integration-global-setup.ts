import { execSync } from "node:child_process";

/**
 * Brings the test database up to the current schema once per run. `migrate deploy` only applies
 * pending migrations; each test starts from empty tables via truncateAll().
 */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("DATABASE_URL_TEST is not set. Copy .env.example to .env.");
  }
  if (!/\/\w+_test(\?|$)/.test(url)) {
    throw new Error("DATABASE_URL_TEST must point at a database whose name ends in _test.");
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
