import { afterEach, describe, expect, it } from "vitest";
import { TEST_BILLING_ENV } from "@tests/setup/billing-env.mjs";
import { intervalOfPrice, isBillingEnabled, paddleClient, paddleClientConfig, webhookSecret } from "./paddle";

afterEach(() => {
  Object.assign(process.env, TEST_BILLING_ENV);
});

describe("billing configuration", () => {
  it("is off in tests: no API key reaches Paddle, whatever .env holds", async () => {
    expect(isBillingEnabled()).toBe(false);
    expect(paddleClientConfig()).toBeNull();
    expect(await paddleClient()).toBeNull();
  });

  it("still verifies webhooks, which only need the secret", () => {
    expect(webhookSecret()).toBe(TEST_BILLING_ENV.PADDLE_WEBHOOK_SECRET);
  });

  it("turns on with a key and both prices, and hands the browser only the client token", () => {
    process.env.PADDLE_API_KEY = "pdl_sdbx_apikey_x";
    process.env.PADDLE_CLIENT_TOKEN = "test_token";
    expect(isBillingEnabled()).toBe(true);
    expect(paddleClientConfig()).toEqual({ token: "test_token", environment: "sandbox" });
  });

  it("stays off when a price is missing", () => {
    process.env.PADDLE_API_KEY = "pdl_sdbx_apikey_x";
    process.env.PADDLE_PRICE_PRO_YEARLY = "";
    expect(isBillingEnabled()).toBe(false);
  });

  it("recognises only our own prices", () => {
    expect(intervalOfPrice(TEST_BILLING_ENV.PADDLE_PRICE_PRO_MONTHLY)).toBe("MONTH");
    expect(intervalOfPrice(TEST_BILLING_ENV.PADDLE_PRICE_PRO_YEARLY)).toBe("YEAR");
    // Another product in the shared sandbox.
    expect(intervalOfPrice("pri_01kxhgnzse29n9pg7sz5y74jmp")).toBeNull();
  });
});
