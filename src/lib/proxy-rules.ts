const PUBLIC_PATHS = ["/sign-in", "/sign-up"];
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

/**
 * Optimistic gate for app pages: without any session cookie, send the visitor to sign-in.
 * The real check (a valid session and a business) happens in the layouts.
 */
export function signInRedirectFor(pathname: string, search: string, cookieNames: string[]): string | null {
  if (PUBLIC_PATHS.includes(pathname)) return null;
  if (cookieNames.some((name) => SESSION_COOKIE.test(name))) return null;
  const target = `${pathname}${search}`;
  return target === "/" || target === "/overview"
    ? "/sign-in"
    : `/sign-in?callbackUrl=${encodeURIComponent(target)}`;
}
