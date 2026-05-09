import { Redis } from "@upstash/redis";

// ── Redis client (only created when env vars are present) ──────────────────
let redis: Redis | null = null;
if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// ── In-memory fallback store ───────────────────────────────────────────────
interface MemEntry {
  v: unknown;
  exp: number; // absolute timestamp (ms)
}
const mem = new Map<string, MemEntry>();

// Periodically sweep expired in-memory entries to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of mem.entries()) {
      if (entry.exp <= now) mem.delete(key);
    }
  }, 60_000); // sweep every 60 seconds
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  // 1. Try Redis
  if (redis) {
    try {
      const val = await redis.get<T>(key);
      if (val !== null && val !== undefined) return val;
    } catch {
      // Redis down or network error — fall through to memory
    }
  }

  // 2. In-memory fallback
  const entry = mem.get(key);
  if (entry && entry.exp > Date.now()) {
    return entry.v as T;
  }

  return null;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  // Write to Redis (non-blocking on failure)
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch {
      // Silent — in-memory will still be set below
    }
  }

  // Always write to in-memory as the fallback layer
  mem.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
}

/**
 * Delete a key from both cache layers.
 */
export async function cacheDel(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // Silent
    }
  }
  mem.delete(key);
}

export function cacheDelPrefix(prefix: string): void {
  for (const key of mem.keys()) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
}

// ── TTL constants (in seconds) ─────────────────────────────────────────────
export const TTL = {
  CATALOGUE: 5 * 60, // 5 minutes
  CHARACTERS: 5 * 60, // 5 minutes
  PRESIGNED_URL: 45 * 60, // 45 minutes (S3/R2 URLs valid for 1hr)
  CREDIT_CHECK: 30, // 30 seconds
  ADMIN_CREDITS: 2 * 60, // 2 minutes
} as const;
