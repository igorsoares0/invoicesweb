import { describe, expect, it } from "vitest";
import { signPaddlePayload, verifyPaddleSignature } from "./signature";

const secret = "pdl_ntfset_secret";
const body = '{"event_id":"evt_1","event_type":"subscription.created"}';
const now = new Date("2026-09-18T12:00:00.000Z");

describe("verifyPaddleSignature", () => {
  it("accepts what Paddle signs", () => {
    expect(verifyPaddleSignature(body, signPaddlePayload(body, secret, now), secret, now)).toBe(true);
  });

  it("rejects a changed body or another secret", () => {
    const header = signPaddlePayload(body, secret, now);
    expect(verifyPaddleSignature(`${body} `, header, secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, header, "another_secret", now)).toBe(false);
  });

  it("rejects a replay older than the tolerance", () => {
    const header = signPaddlePayload(body, secret, new Date(now.getTime() - 301_000));
    expect(verifyPaddleSignature(body, header, secret, now)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyPaddleSignature(body, null, secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, "h1=abc", secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, "ts=abc;h1=abc", secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${Math.floor(now.getTime() / 1000)};h1=zz`, secret, now)).toBe(false);
  });

  it("accepts any of several signatures while the secret rotates", () => {
    const valid = signPaddlePayload(body, secret, now);
    const ts = valid.split(";")[0];
    const h1 = valid.split(";")[1];
    expect(verifyPaddleSignature(body, `${ts};h1=${"0".repeat(64)};${h1}`, secret, now)).toBe(true);
  });
});
