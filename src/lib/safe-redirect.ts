/** Only same-origin paths are allowed as post-login destinations, to prevent open redirects. */
export function safeRedirectPath(value: unknown, fallback = "/overview"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
