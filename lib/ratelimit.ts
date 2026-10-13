import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const limiters = redis
  ? [
      new Ratelimit({ redis, prefix: "chat:hour", limiter: Ratelimit.slidingWindow(20, "1 h") }),
      new Ratelimit({ redis, prefix: "chat:day", limiter: Ratelimit.slidingWindow(60, "1 d") }),
    ]
  : [];

if (!redis) console.warn("Rate limiting disabled: no Upstash Redis credentials set.");

export function clientId(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

// Returns the seconds until the visitor may ask again, or null if allowed.
// Fails open: a Redis outage shouldn't take the Q&A down.
export async function checkRateLimit(id: string): Promise<number | null> {
  try {
    for (const limiter of limiters) {
      const { success, reset } = await limiter.limit(id);
      if (!success) return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    }
  } catch (err) {
    console.error("Rate limit check failed", err);
  }
  return null;
}
