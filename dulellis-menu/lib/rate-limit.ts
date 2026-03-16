type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function getUpstashConfig() {
  const baseUrl = String(process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

function buildMemoryRateLimitResult({
  count,
  limit,
  resetAt,
  now,
}: {
  count: number;
  limit: number;
  resetAt: number;
  now: number;
}): RateLimitResult {
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function checkRateLimitInMemory(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(options.key, {
      count: 1,
      resetAt,
    });
    return buildMemoryRateLimitResult({
      count: 1,
      limit: options.limit,
      resetAt,
      now,
    });
  }

  if (current.count >= options.limit) {
    return buildMemoryRateLimitResult({
      count: current.count,
      limit: options.limit,
      resetAt: current.resetAt,
      now,
    });
  }

  current.count += 1;
  buckets.set(options.key, current);
  return buildMemoryRateLimitResult({
    count: current.count,
    limit: options.limit,
    resetAt: current.resetAt,
    now,
  });
}

function normalizeUpstashNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function checkRateLimitInUpstash(options: RateLimitOptions): Promise<RateLimitResult | null> {
  const config = getUpstashConfig();
  if (!config) return null;

  const key = `ratelimit:${options.key}`;
  const response = await fetch(`${config.baseUrl}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(options.windowMs), "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit failed with status ${response.status}`);
  }

  const data = (await response.json().catch(() => [])) as Array<{ result?: unknown } | null>;
  const count = normalizeUpstashNumber(data?.[0]?.result);
  const ttlMs = Math.max(0, normalizeUpstashNumber(data?.[2]?.result));
  const retryAfterSeconds = Math.max(1, Math.ceil((ttlMs || options.windowMs) / 1000));

  return {
    allowed: count <= options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds,
  };
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const upstashResult = await checkRateLimitInUpstash(options);
    if (upstashResult) return upstashResult;
  } catch {
    // Fall back to in-memory buckets if the centralized limiter is unavailable.
  }

  return checkRateLimitInMemory(options);
}

export function cleanupExpiredBuckets(maxEntries = 5000): void {
  if (buckets.size <= maxEntries) return;
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}
