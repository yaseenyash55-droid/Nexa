import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

// Fallback in-memory map if Redis is not configured or offline
const localFallbackMap = new Map<string, number>();

/**
 * Initialize centralized Redis client for distributed locking, rate-limiting, and idempotency
 */
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const rawUrl = env.REDIS_URL?.trim();
  const isInvalid =
    !rawUrl ||
    rawUrl === '' ||
    rawUrl.includes('your-redis-host') ||
    rawUrl.includes('example.com') ||
    rawUrl.includes('placeholder');

  if (isInvalid) {
    return null;
  }

  try {
    const isTls = rawUrl.startsWith('rediss://');
    redisClient = new Redis(rawUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      enableReadyCheck: true,
      lazyConnect: false,
      tls: isTls ? { rejectUnauthorized: false } : undefined
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Distributed Redis connection established for AI idempotency and coordination.');
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      logger.warn({ err: err?.message || err }, 'Redis error encountered, operating with local fallback');
    });

    return redisClient;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Redis client, using local in-memory fallback');
    return null;
  }
}

/**
 * Distributed Idempotency Lock
 * Attempts to acquire an atomic distributed lock with a TTL (in seconds).
 * Returns true if lock was successfully acquired (first execution).
 * Returns false if already processed or currently being processed by another cluster node.
 */
export async function acquireDistributedIdempotencyLock(
  key: string,
  ttlSeconds = 60
): Promise<boolean> {
  const client = getRedisClient();

  if (client && isRedisAvailable) {
    try {
      // SET key "processing" NX EX ttlSeconds
      const result = await client.set(`idempotency:${key}`, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      logger.warn({ err, key }, 'Distributed lock via Redis failed, evaluating local fallback');
    }
  }

  // Local fallback with cleanup
  const now = Date.now();
  const existingExpiry = localFallbackMap.get(key);
  if (existingExpiry && now < existingExpiry) {
    return false; // Duplicate
  }

  // Evict expired entries if local fallback map grows
  if (localFallbackMap.size > 2000) {
    for (const [k, exp] of localFallbackMap.entries()) {
      if (now >= exp) localFallbackMap.delete(k);
    }
  }

  localFallbackMap.set(key, now + ttlSeconds * 1000);
  return true;
}

/**
 * Release an idempotency lock if an operation fails before completing
 */
export async function releaseDistributedIdempotencyLock(key: string): Promise<void> {
  const client = getRedisClient();
  if (client && isRedisAvailable) {
    try {
      await client.del(`idempotency:${key}`);
    } catch (err) {
      // Ignore cleanup error
    }
  }
  localFallbackMap.delete(key);
}
