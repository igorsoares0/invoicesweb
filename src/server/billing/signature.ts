import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** How old a signed delivery may be before it's treated as a replay. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Checks a `Paddle-Signature` header (`ts=…;h1=…`): an HMAC-SHA256 of `${ts}:${rawBody}` with the
 * notification destination's secret. Several `h1` values may appear while a secret is rotated;
 * any one matching is enough. Verified locally, so the webhook needs no API key.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!header) return false;
  const parts = header.split(";").map((part) => part.trim().split("="));
  const ts = parts.find(([key]) => key === "ts")?.[1];
  const signatures = parts.filter(([key]) => key === "h1").map(([, value]) => value ?? "");
  if (!ts || !/^\d+$/.test(ts) || !signatures.length) return false;
  if (Math.abs(now.getTime() / 1000 - Number(ts)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Builds a header the way Paddle does. Tests sign their payloads with it. */
export function signPaddlePayload(rawBody: string, secret: string, now: Date = new Date()): string {
  const ts = Math.floor(now.getTime() / 1000);
  const h1 = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}
