import { describe, expect, it } from "vitest";
import { createUser } from "@tests/setup/db";
import { userService } from "./user-service";

describe("userService.authenticateWithPassword", () => {
  it("accepts the right password, case-insensitively on email", async () => {
    const user = await createUser({ email: "ana@alvorada.studio", password: "correct horse battery" });

    const result = await userService.authenticateWithPassword({
      email: "ANA@alvorada.studio",
      password: "correct horse battery",
    });

    expect(result).toEqual({
      ok: true,
      user: { id: user.id, email: "ana@alvorada.studio", name: user.name, image: null },
    });
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createUser({ email: "ana@alvorada.studio", password: "correct horse battery" });

    const wrongPassword = await userService.authenticateWithPassword({
      email: "ana@alvorada.studio",
      password: "wrong password",
    });
    const unknownEmail = await userService.authenticateWithPassword({
      email: "nobody@alvorada.studio",
      password: "wrong password",
    });

    expect(wrongPassword).toEqual({ ok: false, reason: "invalid_credentials", attemptsLeft: 4 });
    expect(unknownEmail).toEqual({ ok: false, reason: "invalid_credentials", attemptsLeft: 4 });
  });

  it("rejects users who only ever signed in with Google", async () => {
    await createUser({ email: "oauth@example.com" });
    const result = await userService.authenticateWithPassword({ email: "oauth@example.com", password: "anything" });
    expect(result.ok).toBe(false);
  });

  it("locks the email after five attempts, even with the right password", async () => {
    await createUser({ email: "ana@alvorada.studio", password: "correct horse battery" });
    for (let i = 0; i < 5; i++) {
      await userService.authenticateWithPassword({ email: "ana@alvorada.studio", password: "wrong password" });
    }

    const result = await userService.authenticateWithPassword({
      email: "ana@alvorada.studio",
      password: "correct horse battery",
    });

    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  it("resets the attempt counter after a successful sign-in", async () => {
    await createUser({ email: "ana@alvorada.studio", password: "correct horse battery" });
    for (let i = 0; i < 4; i++) {
      await userService.authenticateWithPassword({ email: "ana@alvorada.studio", password: "wrong password" });
    }
    await userService.authenticateWithPassword({ email: "ana@alvorada.studio", password: "correct horse battery" });

    const result = await userService.authenticateWithPassword({
      email: "ana@alvorada.studio",
      password: "wrong password",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_credentials", attemptsLeft: 4 });
  });
});
