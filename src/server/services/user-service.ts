import "server-only";
import type { UserDto } from "@/lib/api-types";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";
import { ApiError } from "@/server/api/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { signInLimiter } from "@/server/auth/rate-limit";
import { isPrismaError } from "@/server/repositories/prisma-errors";
import { userRepository } from "@/server/repositories/user-repository";

export const EMAIL_TAKEN_MESSAGE = "An account with this email already exists. Sign in instead.";

export type PasswordAuthResult =
  | { ok: true; user: UserDto }
  | { ok: false; reason: "invalid_credentials"; attemptsLeft: number }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

function toUserDto(user: { id: string; name: string | null; email: string; image: string | null }): UserDto {
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

export const userService = {
  async signUp(input: unknown): Promise<UserDto> {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { email, password, name } = parsed.data;

    if (await userRepository.findByEmail(email)) {
      throw ApiError.validation({ email: [EMAIL_TAKEN_MESSAGE] });
    }
    try {
      const user = await userRepository.create({
        email,
        name: name || null,
        passwordHash: await hashPassword(password),
      });
      return toUserDto(user);
    } catch (error) {
      // Two concurrent sign-ups with the same email: the unique index decides.
      if (isPrismaError(error, "P2002")) throw ApiError.validation({ email: [EMAIL_TAKEN_MESSAGE] });
      throw error;
    }
  },

  /**
   * Checks email + password for the Auth.js Credentials provider. Attempts are limited per email,
   * and the result never reveals whether the email exists.
   */
  async authenticateWithPassword(input: unknown): Promise<PasswordAuthResult> {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "invalid_credentials", attemptsLeft: -1 };
    const { email, password } = parsed.data;

    const limit = signInLimiter.consume(email);
    if (!limit.allowed) {
      return { ok: false, reason: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
    }

    const user = await userRepository.findByEmail(email);
    if (!user?.passwordHash) {
      await burnPasswordCheck(password);
      return { ok: false, reason: "invalid_credentials", attemptsLeft: limit.remaining };
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      return { ok: false, reason: "invalid_credentials", attemptsLeft: limit.remaining };
    }

    signInLimiter.reset(email);
    return { ok: true, user: toUserDto(user) };
  },

  async getById(userId: string): Promise<UserDto | null> {
    const user = await userRepository.findById(userId);
    return user ? toUserDto(user) : null;
  },
};
