import "server-only";
import type { Paddle } from "@paddle/paddle-node-sdk";

export type BillingInterval = "MONTH" | "YEAR";

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Price IDs of the Pro plan. Anything else reaching the webhook belongs to another product. */
export function proPrices(): Record<BillingInterval, string | null> {
  return { MONTH: env("PADDLE_PRICE_PRO_MONTHLY"), YEAR: env("PADDLE_PRICE_PRO_YEARLY") };
}

export function intervalOfPrice(priceId: string): BillingInterval | null {
  const prices = proPrices();
  if (priceId === prices.MONTH) return "MONTH";
  if (priceId === prices.YEAR) return "YEAR";
  return null;
}

/** Checkout, sync and the portal call Paddle's API, so they need a key and both prices. */
export function isBillingEnabled(): boolean {
  const prices = proPrices();
  return Boolean(env("PADDLE_API_KEY") && prices.MONTH && prices.YEAR);
}

/** The webhook only verifies signatures locally, so its secret is all it needs. */
export function webhookSecret(): string | null {
  return env("PADDLE_WEBHOOK_SECRET");
}

export function paddleEnvironment(): "sandbox" | "production" {
  return env("PADDLE_ENV") === "production" ? "production" : "sandbox";
}

/** What the browser needs to open Paddle.js. Passed as props, never baked into the build. */
export function paddleClientConfig(): { token: string; environment: "sandbox" | "production" } | null {
  const token = env("PADDLE_CLIENT_TOKEN");
  return token && isBillingEnabled() ? { token, environment: paddleEnvironment() } : null;
}

let client: Paddle | null = null;

/** The SDK client, imported lazily so tests and billing-less setups never load it. */
export async function paddleClient(): Promise<Paddle | null> {
  const apiKey = env("PADDLE_API_KEY");
  if (!apiKey || !isBillingEnabled()) return null;
  if (!client) {
    const { Environment, Paddle: PaddleClient } = await import("@paddle/paddle-node-sdk");
    client = new PaddleClient(apiKey, {
      environment: paddleEnvironment() === "production" ? Environment.production : Environment.sandbox,
    });
  }
  return client;
}
