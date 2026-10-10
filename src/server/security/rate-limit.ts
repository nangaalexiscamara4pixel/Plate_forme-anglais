import { randomUUID } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { db } from "@/server/db";
import { fingerprint } from "@/server/crypto";

export type RateLimitRule = { limit: number; windowSec: number };

export const RULES = {
  signUp: { limit: 3, windowSec: 60 * 60 },
  signIn: { limit: 10, windowSec: 60 },
  passwordReset: { limit: 3, windowSec: 60 * 60 },
  resendVerification: { limit: 3, windowSec: 60 * 10 },
  twoFactor: { limit: 5, windowSec: 60 },
} satisfies Record<string, RateLimitRule>;

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const upstashLimiters = new Map<string, Ratelimit>();

/**
 * Limiteur à fenêtre fixe. Utilise Upstash Redis s'il est configuré,
 * sinon une table Postgres (upsert atomique — fiable en serverless).
 * Les identifiants (IP, email) sont hachés avant stockage.
 */
export async function rateLimit(
  name: keyof typeof RULES,
  identifier: string,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const rule = RULES[name];
  const key = `app:${name}:${fingerprint(identifier)}`;

  if (redis) {
    let limiter = upstashLimiters.get(name);
    if (!limiter) {
      limiter = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(rule.limit, `${rule.windowSec} s`), prefix: "gs" });
      upstashLimiters.set(name, limiter);
    }
    const res = await limiter.limit(key);
    return { ok: res.success, retryAfterSec: Math.max(0, Math.ceil((res.reset - Date.now()) / 1000)) };
  }

  const now = Date.now();
  const windowStart = now - rule.windowSec * 1000;
  const rows = await db.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rateLimit"."lastRequest" < ${BigInt(windowStart)} THEN 1 ELSE "rateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${BigInt(windowStart)} THEN ${BigInt(now)} ELSE "rateLimit"."lastRequest" END
    RETURNING "count", "lastRequest"`;
  const row = rows[0]!;
  const resetAt = Number(row.lastRequest) + rule.windowSec * 1000;
  return { ok: row.count <= rule.limit, retryAfterSec: Math.max(0, Math.ceil((resetAt - now) / 1000)) };
}
