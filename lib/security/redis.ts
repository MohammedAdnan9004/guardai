import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * GuardAI Multi-Layer Upstash Redis Security Engine
 * - IP & Workspace sliding-window rate limiting
 * - Login brute-force protection (5 failed attempts -> 15 min lock)
 * - Forgot-password OTP spam prevention (max 3 requests / 15 min)
 * - 6-digit OTP verification brute-force protection (max 5 failed attempts / 15 min)
 */

const FIFTEEN_MINUTES_SEC = 15 * 60;
const MAX_LOGIN_FAILURES = 5;
const MAX_OTP_REQUESTS = 3;
const MAX_OTP_VERIFY_FAILURES = 5;

let cachedRedis: Redis | null = null;
const limiterCache = new Map<string, Ratelimit>();

// In-memory fallback store used ONLY when Upstash env vars are not yet configured.
interface MemoryEntry {
  count: number;
  expiresAt: number;
}
const memoryStore = new Map<string, MemoryEntry>();

export function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(
    url &&
      token &&
      !url.includes("your-redis-instance") &&
      !token.includes("your-upstash-redis")
  );
}

function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!cachedRedis) {
    cachedRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    });
  }
  return cachedRedis;
}

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function getMemoryCount(key: string): { count: number; ttlSeconds: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    memoryStore.delete(key);
    return { count: 0, ttlSeconds: 0 };
  }
  return {
    count: entry.count,
    ttlSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
  };
}

function incrementMemoryKey(key: string, ttlSeconds: number): {
  count: number;
  ttlSeconds: number;
} {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.expiresAt <= now) {
    const expiresAt = now + ttlSeconds * 1000;
    memoryStore.set(key, { count: 1, expiresAt });
    return { count: 1, ttlSeconds };
  }
  existing.count += 1;
  return {
    count: existing.count,
    ttlSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
  };
}

function setMemoryKey(key: string, value: number, ttlSeconds: number): void {
  memoryStore.set(key, {
    count: value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function deleteMemoryKey(key: string): void {
  memoryStore.delete(key);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  backend: "upstash" | "memory-fallback";
}

function getOrCreateSlidingLimiter(
  prefix: string,
  limit: number,
  windowSeconds: number
): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const cacheKey = `${prefix}:${limit}:${windowSeconds}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `guardai:rl:${prefix}`,
      analytics: false,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkIpRateLimit(
  ip: string,
  scope: string,
  limit = 20,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const safeIp = hashIdentifier(ip);
  const limiter = getOrCreateSlidingLimiter(`ip:${scope}`, limit, windowSeconds);

  if (limiter) {
    const res = await limiter.limit(safeIp);
    return {
      allowed: res.success,
      limit: res.limit,
      remaining: res.remaining,
      retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      backend: "upstash",
    };
  }

  const key = `rl:ip:${scope}:${safeIp}`;
  const current = incrementMemoryKey(key, windowSeconds);
  return {
    allowed: current.count <= limit,
    limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: current.ttlSeconds,
    backend: "memory-fallback",
  };
}

export async function checkWorkspaceRateLimit(
  workspaceId: string,
  scope: string,
  limit = 60,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const limiter = getOrCreateSlidingLimiter(`ws:${scope}`, limit, windowSeconds);

  if (limiter) {
    const res = await limiter.limit(workspaceId);
    return {
      allowed: res.success,
      limit: res.limit,
      remaining: res.remaining,
      retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      backend: "upstash",
    };
  }

  const key = `rl:ws:${scope}:${workspaceId}`;
  const current = incrementMemoryKey(key, windowSeconds);
  return {
    allowed: current.count <= limit,
    limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: current.ttlSeconds,
    backend: "memory-fallback",
  };
}

export interface BruteForceStatus {
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

function loginKeys(email: string, ip: string) {
  const emailHash = hashIdentifier(email);
  const ipHash = hashIdentifier(ip);
  return {
    failKey: `guardai:bf:login:fail:${emailHash}`,
    lockKey: `guardai:bf:login:lock:${emailHash}`,
    ipFailKey: `guardai:bf:login:ip:${ipHash}`,
  };
}

export async function checkLoginBruteForce(
  email: string,
  ip: string
): Promise<BruteForceStatus> {
  const { failKey, lockKey } = loginKeys(email, ip);
  const redis = getRedisClient();

  if (redis) {
    const [lockVal, lockTtl, failCount] = await Promise.all([
      redis.get<number>(lockKey),
      redis.ttl(lockKey),
      redis.get<number>(failKey),
    ]);

    if (lockVal) {
      return {
        locked: true,
        attempts: MAX_LOGIN_FAILURES,
        remainingAttempts: 0,
        retryAfterSeconds: lockTtl > 0 ? lockTtl : FIFTEEN_MINUTES_SEC,
      };
    }

    const attempts = Number(failCount ?? 0);
    return {
      locked: false,
      attempts,
      remainingAttempts: Math.max(0, MAX_LOGIN_FAILURES - attempts),
      retryAfterSeconds: 0,
    };
  }

  const lockState = getMemoryCount(lockKey);
  if (lockState.count > 0) {
    return {
      locked: true,
      attempts: MAX_LOGIN_FAILURES,
      remainingAttempts: 0,
      retryAfterSeconds: lockState.ttlSeconds,
    };
  }

  const failState = getMemoryCount(failKey);
  return {
    locked: false,
    attempts: failState.count,
    remainingAttempts: Math.max(0, MAX_LOGIN_FAILURES - failState.count),
    retryAfterSeconds: 0,
  };
}

export async function recordFailedLoginAttempt(
  email: string,
  ip: string
): Promise<BruteForceStatus> {
  const { failKey, lockKey } = loginKeys(email, ip);
  const redis = getRedisClient();

  if (redis) {
    const count = await redis.incr(failKey);
    if (count === 1) {
      await redis.expire(failKey, FIFTEEN_MINUTES_SEC);
    }

    if (count >= MAX_LOGIN_FAILURES) {
      await redis.set(lockKey, 1, { ex: FIFTEEN_MINUTES_SEC });
      return {
        locked: true,
        attempts: count,
        remainingAttempts: 0,
        retryAfterSeconds: FIFTEEN_MINUTES_SEC,
      };
    }

    return {
      locked: false,
      attempts: count,
      remainingAttempts: Math.max(0, MAX_LOGIN_FAILURES - count),
      retryAfterSeconds: 0,
    };
  }

  const failState = incrementMemoryKey(failKey, FIFTEEN_MINUTES_SEC);
  if (failState.count >= MAX_LOGIN_FAILURES) {
    setMemoryKey(lockKey, 1, FIFTEEN_MINUTES_SEC);
    return {
      locked: true,
      attempts: failState.count,
      remainingAttempts: 0,
      retryAfterSeconds: FIFTEEN_MINUTES_SEC,
    };
  }

  return {
    locked: false,
    attempts: failState.count,
    remainingAttempts: Math.max(0, MAX_LOGIN_FAILURES - failState.count),
    retryAfterSeconds: 0,
  };
}

export async function clearFailedLoginAttempts(
  email: string,
  ip: string
): Promise<void> {
  const { failKey, lockKey } = loginKeys(email, ip);
  const redis = getRedisClient();

  if (redis) {
    await redis.del(failKey, lockKey);
    return;
  }

  deleteMemoryKey(failKey);
  deleteMemoryKey(lockKey);
}

export interface OtpRateLimitStatus {
  allowed: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkAndConsumeOtpRateLimit(
  email: string,
  ip: string
): Promise<OtpRateLimitStatus> {
  const emailKey = `guardai:otp:req:email:${hashIdentifier(email)}`;
  const ipKey = `guardai:otp:req:ip:${hashIdentifier(ip)}`;
  const redis = getRedisClient();

  if (redis) {
    const [emailCurrent, ipCurrent] = await Promise.all([
      redis.get<number>(emailKey),
      redis.get<number>(ipKey),
    ]);

    const emailCount = Number(emailCurrent ?? 0);
    const ipCount = Number(ipCurrent ?? 0);

    if (emailCount >= MAX_OTP_REQUESTS || ipCount >= MAX_OTP_REQUESTS * 2) {
      const [emailTtl, ipTtl] = await Promise.all([
        redis.ttl(emailKey),
        redis.ttl(ipKey),
      ]);
      const retryAfter = Math.max(emailTtl, ipTtl, 60);
      return {
        allowed: false,
        attemptsUsed: emailCount,
        maxAttempts: MAX_OTP_REQUESTS,
        remaining: 0,
        retryAfterSeconds: retryAfter,
      };
    }

    const [nextEmail, nextIp] = await Promise.all([
      redis.incr(emailKey),
      redis.incr(ipKey),
    ]);
    if (nextEmail === 1) await redis.expire(emailKey, FIFTEEN_MINUTES_SEC);
    if (nextIp === 1) await redis.expire(ipKey, FIFTEEN_MINUTES_SEC);

    return {
      allowed: true,
      attemptsUsed: nextEmail,
      maxAttempts: MAX_OTP_REQUESTS,
      remaining: Math.max(0, MAX_OTP_REQUESTS - nextEmail),
      retryAfterSeconds: 0,
    };
  }

  const emailState = getMemoryCount(emailKey);
  const ipState = getMemoryCount(ipKey);
  if (emailState.count >= MAX_OTP_REQUESTS || ipState.count >= MAX_OTP_REQUESTS * 2) {
    return {
      allowed: false,
      attemptsUsed: emailState.count,
      maxAttempts: MAX_OTP_REQUESTS,
      remaining: 0,
      retryAfterSeconds: Math.max(emailState.ttlSeconds, ipState.ttlSeconds, 60),
    };
  }

  const nextEmail = incrementMemoryKey(emailKey, FIFTEEN_MINUTES_SEC);
  incrementMemoryKey(ipKey, FIFTEEN_MINUTES_SEC);
  return {
    allowed: true,
    attemptsUsed: nextEmail.count,
    maxAttempts: MAX_OTP_REQUESTS,
    remaining: Math.max(0, MAX_OTP_REQUESTS - nextEmail.count),
    retryAfterSeconds: 0,
  };
}

export async function checkOtpVerifyAttempt(
  email: string
): Promise<{ locked: boolean; retryAfterSeconds: number; remaining: number }> {
  const key = `guardai:otp:verify-fail:${hashIdentifier(email)}`;
  const redis = getRedisClient();

  if (redis) {
    const [countRaw, ttl] = await Promise.all([
      redis.get<number>(key),
      redis.ttl(key),
    ]);
    const count = Number(countRaw ?? 0);
    if (count >= MAX_OTP_VERIFY_FAILURES) {
      return {
        locked: true,
        retryAfterSeconds: ttl > 0 ? ttl : FIFTEEN_MINUTES_SEC,
        remaining: 0,
      };
    }
    return {
      locked: false,
      retryAfterSeconds: 0,
      remaining: Math.max(0, MAX_OTP_VERIFY_FAILURES - count),
    };
  }

  const state = getMemoryCount(key);
  if (state.count >= MAX_OTP_VERIFY_FAILURES) {
    return {
      locked: true,
      retryAfterSeconds: state.ttlSeconds,
      remaining: 0,
    };
  }
  return {
    locked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, MAX_OTP_VERIFY_FAILURES - state.count),
  };
}

export async function recordOtpVerifyFailure(email: string): Promise<number> {
  const key = `guardai:otp:verify-fail:${hashIdentifier(email)}`;
  const redis = getRedisClient();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, FIFTEEN_MINUTES_SEC);
    return Math.max(0, MAX_OTP_VERIFY_FAILURES - count);
  }

  const state = incrementMemoryKey(key, FIFTEEN_MINUTES_SEC);
  return Math.max(0, MAX_OTP_VERIFY_FAILURES - state.count);
}

export async function clearOtpVerifyLimits(email: string): Promise<void> {
  const emailHash = hashIdentifier(email);
  const verifyKey = `guardai:otp:verify-fail:${emailHash}`;
  const reqKey = `guardai:otp:req:email:${emailHash}`;
  const redis = getRedisClient();

  if (redis) {
    await redis.del(verifyKey, reqKey);
    return;
  }

  deleteMemoryKey(verifyKey);
  deleteMemoryKey(reqKey);
}
