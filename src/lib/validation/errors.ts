import type { z } from "zod";

export type FieldErrors = Record<string, string[]>;

/** Flattens zod issues into `path → messages`; issues without a path go under `_form`. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
