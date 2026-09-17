import "server-only";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

/**
 * Where the public links in an email should point. `AUTH_URL` wins whenever it is set: the
 * `Host` header is attacker-controlled, and a forged one would put someone else's domain into
 * an email we send. Without it we trust the proxy headers, then the request itself.
 */
export function resolveBaseUrl(request: Request): string {
  const configured = clean(process.env.AUTH_URL);
  if (configured) return configured;

  const forwardedHost = clean(request.headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const proto = clean(request.headers.get("x-forwarded-proto"))?.split(",")[0] ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}
