import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  function setup(limit = 3) {
    let time = 1_000_000;
    const limiter = createRateLimiter({ limit, windowMs: 60_000, now: () => time });
    return { limiter, advance: (ms: number) => (time += ms) };
  }

  it("allows up to the limit and reports what's left", () => {
    const { limiter } = setup();
    expect(limiter.consume("a")).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    expect(limiter.consume("a").remaining).toBe(1);
    expect(limiter.consume("a").remaining).toBe(0);
    expect(limiter.consume("a")).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  });

  it("opens a new window once the old one expires", () => {
    const { limiter, advance } = setup(1);
    limiter.consume("a");
    advance(30_000);
    expect(limiter.consume("a")).toMatchObject({ allowed: false, retryAfterSeconds: 30 });
    advance(30_000);
    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const { limiter } = setup(1);
    limiter.consume("a");
    expect(limiter.consume("b").allowed).toBe(true);
  });

  it("reset clears a single key", () => {
    const { limiter } = setup(1);
    limiter.consume("a");
    limiter.consume("b");
    limiter.reset("a");
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
