import type { ApiError } from "./errors";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function created<T>(data: T): Response {
  return ok(data, 201);
}

export function list<T>(data: T[], pagination: Pagination): Response {
  return Response.json({ data, pagination });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function errorResponse(error: ApiError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status, headers: error.headers },
  );
}
