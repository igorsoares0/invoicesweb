import type { FieldErrors } from "@/lib/validation/errors";

export type { FieldErrors };

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  PAYMENT_ERROR: "PAYMENT_ERROR",
  WEBHOOK_INVALID: "WEBHOOK_INVALID",
  RATE_LIMITED: "RATE_LIMITED",
  EMAIL_DISABLED: "EMAIL_DISABLED",
  BILLING_DISABLED: "BILLING_DISABLED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  SUBSCRIPTION_REQUIRED: 402,
  PLAN_LIMIT_REACHED: 402,
  INVALID_STATUS_TRANSITION: 409,
  PAYMENT_ERROR: 402,
  WEBHOOK_INVALID: 400,
  RATE_LIMITED: 429,
  EMAIL_DISABLED: 503,
  BILLING_DISABLED: 503,
  INTERNAL_ERROR: 500,
};


export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: FieldErrors;
  readonly headers?: Record<string, string>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: FieldErrors; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = "You don't have access to this resource") {
    return new ApiError(ErrorCode.FORBIDDEN, message);
  }

  static notFound(resource: string) {
    return new ApiError(ErrorCode.RESOURCE_NOT_FOUND, `${resource} not found`);
  }

  static validation(details: FieldErrors, message = "The request contains invalid data") {
    return new ApiError(ErrorCode.VALIDATION_ERROR, message, { details });
  }

  static conflict(message: string) {
    return new ApiError(ErrorCode.CONFLICT, message);
  }

  static rateLimited(retryAfterSeconds: number) {
    return new ApiError(ErrorCode.RATE_LIMITED, "Too many requests. Try again later.", {
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }
}
