"use client";

import { useCallback, useState } from "react";
import { ApiClientError } from "@/lib/api-client";

export type FormErrors = Record<string, string[]>;

export function toFormErrors(error: unknown): FormErrors {
  if (error instanceof ApiClientError && Object.keys(error.details).length > 0) return error.details;
  return { _form: [error instanceof Error ? error.message : "Something went wrong"] };
}

/**
 * Tracks pending state and server-side field errors for a form that submits to /api/v1.
 * The API is the source of truth for validation; this only renders what it returns.
 */
export function useApiForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);

  const submit = useCallback(async <T,>(request: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setErrors({});
    try {
      return await request();
    } catch (error) {
      setErrors(toFormErrors(error));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const error = useCallback((field: string) => errors[field]?.[0], [errors]);

  return { errors, error, pending, submit, setErrors };
}
