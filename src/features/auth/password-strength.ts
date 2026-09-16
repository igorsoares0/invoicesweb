import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";

export interface PasswordStrength {
  /** 0 (empty) to 4 (strong); drives the four-segment meter. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/** A quick hint for the sign-up form. The server only enforces the minimum length. */
export function measurePassword(password: string): PasswordStrength {
  if (password.length === 0) return { score: 0, label: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { score: 1, label: `Too short — ${password.length} of ${PASSWORD_MIN_LENGTH} characters.` };
  }

  const mixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const digitOrSymbol = /[^A-Za-z]/.test(password);
  const variety = Number(mixedCase) + Number(digitOrSymbol);
  const traits = [mixedCase && "mixed case", digitOrSymbol && "numbers or symbols"].filter(Boolean).join(", ");
  const description = `${password.length} characters${traits ? `, ${traits}` : ""}.`;

  if (password.length >= 16 && variety === 2) return { score: 4, label: `Very strong — ${description}` };
  if (variety >= 1 || password.length >= 16) return { score: 3, label: `Strong — ${description}` };
  return { score: 2, label: `Fair — ${description} Mix in capitals or numbers.` };
}
