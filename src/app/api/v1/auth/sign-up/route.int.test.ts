import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { callRoute } from "@tests/setup/http";
import { POST } from "./route";

const signUp = (body: unknown, headers?: Record<string, string>) =>
  callRoute(POST, { method: "POST", path: "/api/v1/auth/sign-up", body, headers });

describe("POST /api/v1/auth/sign-up", () => {
  it("creates a user with a hashed password", async () => {
    const { status, json } = await signUp({ email: "Ana@Alvorada.Studio", password: "correct horse battery" });

    expect(status).toBe(201);
    expect(json.data).toMatchObject({ email: "ana@alvorada.studio", name: null });
    expect(json.data).not.toHaveProperty("passwordHash");

    const user = await db.user.findUniqueOrThrow({ where: { email: "ana@alvorada.studio" } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain("correct horse battery");
  });

  it("rejects an email that is already registered", async () => {
    await signUp({ email: "ana@alvorada.studio", password: "correct horse battery" });
    const { status, json } = await signUp({ email: "ANA@alvorada.studio", password: "another password 1" });

    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details.email).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });

  it("validates email and password length", async () => {
    const { status, json } = await signUp({ email: "nope", password: "short" });

    expect(status).toBe(422);
    expect(Object.keys(json.error.details).sort()).toEqual(["email", "password"]);
  });

  it("rate limits repeated sign-ups from one IP", async () => {
    const headers = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 10; i++) {
      await signUp({ email: `bot${i}@example.com`, password: "short" }, headers);
    }
    const { status, headers: responseHeaders, json } = await signUp(
      { email: "bot11@example.com", password: "correct horse battery" },
      headers,
    );

    expect(status).toBe(429);
    expect(json.error.code).toBe("RATE_LIMITED");
    expect(Number(responseHeaders.get("Retry-After"))).toBeGreaterThan(0);
  });
});
