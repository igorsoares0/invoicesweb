/** Returns `pathname?query` with the given params set; `null`/`undefined`/"" remove a param. */
export function withSearchParams(
  pathname: string,
  current: URLSearchParams | Record<string, string | undefined>,
  changes: Record<string, string | number | null | undefined>,
): string {
  const params =
    current instanceof URLSearchParams
      ? new URLSearchParams(current)
      : new URLSearchParams(Object.entries(current).filter((entry): entry is [string, string] => entry[1] !== undefined));
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Next.js search params can repeat a key; list screens only care about the first value. */
export function firstValues(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}
