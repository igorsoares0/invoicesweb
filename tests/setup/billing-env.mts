/**
 * Billing settings every test run uses, whatever `.env` holds: no API key (so nothing can reach
 * Paddle), a fixed webhook secret the tests sign with, and fake price IDs.
 */
export const TEST_WEBHOOK_SECRET = "pdl_ntfset_test_secret";

export const TEST_BILLING_ENV = {
  PADDLE_ENV: "sandbox",
  PADDLE_API_KEY: "",
  PADDLE_CLIENT_TOKEN: "",
  PADDLE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
  PADDLE_PRICE_PRO_MONTHLY: "pri_test_pro_monthly",
  PADDLE_PRICE_PRO_YEARLY: "pri_test_pro_yearly",
} as const;
