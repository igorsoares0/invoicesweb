import type { ApiErrorBody, ApiList } from "./api-types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** First message for a field, for rendering under an input. */
  fieldError(field: string): string | undefined {
    return this.details[field]?.[0];
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as ({ data?: T } & Partial<ApiErrorBody>) | null;
  if (!response.ok || !payload) {
    const error = payload?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Something went wrong",
      error?.details,
    );
  }
  return payload as T;
}

/** Thin client for /api/v1 used by client components. Unwraps the `{ data }` envelope. */
export function createApiClient(fetchImpl?: typeof fetch) {
  return {
    async get<T>(path: string): Promise<T> {
      return (await request<{ data: T }>("GET", path, undefined, fetchImpl)).data;
    },
    list<T>(path: string): Promise<ApiList<T>> {
      return request<ApiList<T>>("GET", path, undefined, fetchImpl);
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      return (await request<{ data: T }>("POST", path, body, fetchImpl)).data;
    },
    async patch<T>(path: string, body: unknown): Promise<T> {
      return (await request<{ data: T }>("PATCH", path, body, fetchImpl)).data;
    },
    async delete(path: string): Promise<void> {
      await request<void>("DELETE", path, undefined, fetchImpl);
    },
  };
}

export const api = createApiClient();
