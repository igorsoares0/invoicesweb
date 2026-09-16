import { z } from "zod";
import { email } from "./common";

export const PASSWORD_MIN_LENGTH = 10;

export const signUpSchema = z.object({
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(200, "Use at most 200 characters"),
  name: z.string().trim().max(120).optional(),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
