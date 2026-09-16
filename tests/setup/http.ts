type RouteHandler<TParams> = (request: Request, context: { params: Promise<TParams> }) => Promise<Response>;

/** Invokes an exported route handler the way Next.js would, and decodes the JSON response. */
export async function callRoute<TParams = Record<string, never>>(
  handler: RouteHandler<TParams>,
  options: {
    method?: string;
    path?: string;
    body?: unknown;
    rawBody?: string;
    params?: TParams;
    headers?: Record<string, string>;
  } = {},
) {
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  const request = new Request(`http://localhost${options.path ?? "/"}`, {
    method: options.method ?? "GET",
    body,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const response = await handler(request, { params: Promise.resolve((options.params ?? {}) as TParams) });
  const text = await response.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on arbitrary JSON
  const json: any = text ? JSON.parse(text) : null;
  return { status: response.status, headers: response.headers, json };
}
