/** Business dates are plain calendar days ("2026-09-12"), never instants, so time zones can't shift them. */
export type IsoDate = string;

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Prisma returns `@db.Date` columns as UTC midnight. */
export function toIsoDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

export function fromIsoDate(value: IsoDate): Date {
  return new Date(`${value}T00:00:00Z`);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions, locale: string) {
  const key = `${locale}:${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    formatters.set(key, cached);
  }
  return cached;
}

/** "Sep 12, 2026" */
export function formatDate(date: IsoDate, locale = "en-US"): string {
  return formatter({ month: "short", day: "numeric", year: "numeric" }, locale).format(fromIsoDate(date));
}

/** "September 12, 2026" */
export function formatLongDate(date: IsoDate, locale = "en-US"): string {
  return formatter({ month: "long", day: "numeric", year: "numeric" }, locale).format(fromIsoDate(date));
}

/** "Sep 12" */
export function formatShortDate(date: IsoDate, locale = "en-US"): string {
  return formatter({ month: "short", day: "numeric" }, locale).format(fromIsoDate(date));
}

/** "Aug 28, 10:14" in the viewer's zone. */
export function formatTimestamp(iso: string, timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
