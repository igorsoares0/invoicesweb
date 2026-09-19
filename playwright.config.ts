import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { TEST_BILLING_ENV } from "./tests/setup/billing-env.mjs";

loadEnv({ quiet: true });
// The spec process and the built server both inherit this: no real Paddle key in a test run.
Object.assign(process.env, TEST_BILLING_ENV);

const PORT = 3100;
const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("DATABASE_URL_TEST is not set. Copy .env.example to .env.");

/**
 * E2E runs a production build against the test database. It shares that database with the
 * integration tests, so don't run `test:int` and `test:e2e` at the same time.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/support/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /phone\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "phone",
      testMatch: /phone\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    timeout: 600_000,
    reuseExistingServer: false,
    // EMAIL_TRANSPORT is explicit: the built server inherits `.env`, and a real key must never send.
    env: { DATABASE_URL: databaseUrl, EMAIL_TRANSPORT: "capture", ...TEST_BILLING_ENV },
    stdout: "ignore",
    stderr: "pipe",
  },
});
