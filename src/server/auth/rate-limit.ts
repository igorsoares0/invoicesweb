export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string): RateLimitResult;
  reset(key: string): void;
  clear(): void;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window, in-memory limiter. Good enough for a single Node process (spec §54);
 * swap the store for Redis once the app runs on more than one instance.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;
  const windows = new Map<string, Window>();

  function sweep(time: number) {
    if (windows.size < 10_000) return;
    for (const [key, window] of windows) {
      if (window.resetAt <= time) windows.delete(key);
    }
  }

  return {
    consume(key) {
      const time = now();
      sweep(time);
      let window = windows.get(key);
      if (!window || window.resetAt <= time) {
        window = { count: 0, resetAt: time + windowMs };
        windows.set(key, window);
      }
      window.count += 1;
      const allowed = window.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - window.count),
        retryAfterSeconds: allowed ? 0 : Math.ceil((window.resetAt - time) / 1000),
      };
    },
    reset(key) {
      windows.delete(key);
    },
    clear() {
      windows.clear();
    },
  };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Failed and successful attempts both count; a successful sign-in resets its key. */
export const signInLimiter = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
export const signUpLimiter = createRateLimiter({ limit: 10, windowMs: FIFTEEN_MINUTES });

export function resetRateLimits() {
  signInLimiter.clear();
  signUpLimiter.clear();
}

/** Best-effort client IP. Only trustworthy behind a reverse proxy that overwrites the header. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
