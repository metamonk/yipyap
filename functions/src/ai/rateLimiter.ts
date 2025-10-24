/**
 * Rate limiting service for AI operations
 * @module functions/src/ai/rateLimiter
 */

import { Redis } from '@upstash/redis';
import type { AIError } from '../types/ai';

/**
 * Rate limit configuration
 * @remarks
 * Defines limits per user per operation type to prevent abuse and control costs.
 */
const RATE_LIMITS = {
  /** Default limit for AI operations (requests per hour) */
  default: 100,

  /** Limit for message categorization (high-volume operation) */
  categorization: 200,

  /** Limit for response generation (quality-priority operation) */
  generation: 50,

  /** Limit for sentiment analysis */
  sentiment: 200,
} as const;

/**
 * Time window for rate limiting (1 hour in seconds)
 */
const WINDOW_SIZE_SECONDS = 3600;

/**
 * Redis client instance (initialized lazily)
 */
let redisClient: Redis | null = null;

/**
 * Initializes Upstash Redis client for rate limiting
 *
 * @param url - Upstash Redis REST URL
 * @param token - Upstash Redis REST token
 * @returns True if successfully initialized, false otherwise
 *
 * @remarks
 * Should be called once during service initialization.
 * If credentials are not provided, rate limiting will be disabled (log warnings but continue).
 *
 * @example
 * ```typescript
 * const initialized = initRateLimiter(
 *   process.env.UPSTASH_REDIS_REST_URL,
 *   process.env.UPSTASH_REDIS_REST_TOKEN
 * );
 * ```
 */
export function initRateLimiter(url?: string, token?: string): boolean {
  if (!url || !token) {
    console.warn('[RateLimiter] Redis not configured, rate limiting disabled');
    return false;
  }

  try {
    redisClient = new Redis({
      url,
      token,
    });

    console.log('[RateLimiter] Upstash Redis initialized successfully');
    return true;
  } catch (error) {
    console.error('[RateLimiter] Failed to initialize Redis', { error });
    return false;
  }
}

/**
 * Checks if a user has exceeded their rate limit for an operation
 *
 * @param userId - User ID to check
 * @param operation - Operation type (e.g., 'categorization', 'generation')
 * @returns Promise resolving to result with allowed flag and optional error
 *
 * @remarks
 * Uses sliding window algorithm:
 * 1. Get current timestamp
 * 2. Remove expired requests from sorted set (older than window)
 * 3. Count remaining requests
 * 4. If under limit, add current request and allow
 * 5. If over limit, return rate limit error
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit('user123', 'categorization');
 * if (!result.allowed) {
 *   console.error('Rate limit exceeded:', result.error);
 *   // Return error to user
 * }
 * ```
 */
export async function checkRateLimit(
  userId: string,
  operation: string
): Promise<{ allowed: boolean; error?: AIError }> {
  // If Redis not configured, allow all requests
  if (!redisClient) {
    return { allowed: true };
  }

  try {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_SECONDS * 1000;
    const key = `ratelimit:${userId}:${operation}`;

    // Get limit for this operation type
    const limit = RATE_LIMITS[operation as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;

    // Remove expired requests (sliding window)
    await redisClient.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const requestCount = await redisClient.zcard(key);

    // Check if limit exceeded
    if (requestCount >= limit) {
      const error: AIError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded for ${operation}. Please try again later.`,
        type: 'rate_limit',
        retryable: true,
      };

      console.warn('[RateLimiter] Rate limit exceeded', {
        userId,
        operation,
        requestCount,
        limit,
      });

      return { allowed: false, error };
    }

    // Add current request to sorted set
    await redisClient.zadd(key, { score: now, member: `${now}-${Math.random()}` });

    // Set expiration on key (cleanup)
    await redisClient.expire(key, WINDOW_SIZE_SECONDS);

    console.log('[RateLimiter] Request allowed', {
      userId,
      operation,
      requestCount: requestCount + 1,
      limit,
    });

    return { allowed: true };
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit', { error, userId, operation });

    // Fail open: allow request if rate limiter fails
    return { allowed: true };
  }
}

/**
 * Gets current request count for a user and operation
 *
 * @param userId - User ID to check
 * @param operation - Operation type
 * @returns Promise resolving to current count and limit
 *
 * @remarks
 * Useful for displaying rate limit status to users.
 *
 * @example
 * ```typescript
 * const { count, limit } = await getRateLimitStatus('user123', 'generation');
 * console.log(`You have used ${count} of ${limit} requests this hour`);
 * ```
 */
export async function getRateLimitStatus(
  userId: string,
  operation: string
): Promise<{ count: number; limit: number; resetIn: number }> {
  if (!redisClient) {
    return {
      count: 0,
      limit: RATE_LIMITS[operation as keyof typeof RATE_LIMITS] || RATE_LIMITS.default,
      resetIn: WINDOW_SIZE_SECONDS,
    };
  }

  try {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_SECONDS * 1000;
    const key = `ratelimit:${userId}:${operation}`;

    // Remove expired requests
    await redisClient.zremrangebyscore(key, 0, windowStart);

    // Count remaining requests
    const count = await redisClient.zcard(key);
    const limit = RATE_LIMITS[operation as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;

    // Get oldest request timestamp to calculate reset time
    const oldest = await redisClient.zrange(key, 0, 0, { withScores: true });
    const resetIn =
      oldest.length > 0
        ? Math.max(0, WINDOW_SIZE_SECONDS - Math.floor((now - Number(oldest[1])) / 1000))
        : WINDOW_SIZE_SECONDS;

    return { count, limit, resetIn };
  } catch (error) {
    console.error('[RateLimiter] Error getting status', { error, userId, operation });
    return {
      count: 0,
      limit: RATE_LIMITS[operation as keyof typeof RATE_LIMITS] || RATE_LIMITS.default,
      resetIn: WINDOW_SIZE_SECONDS,
    };
  }
}

/**
 * Resets rate limit for a user and operation
 *
 * @param userId - User ID to reset
 * @param operation - Operation type to reset
 *
 * @remarks
 * Administrative function for manual rate limit resets.
 * Use with caution.
 *
 * @example
 * ```typescript
 * await resetRateLimit('user123', 'generation');
 * console.log('Rate limit reset for user');
 * ```
 */
export async function resetRateLimit(userId: string, operation: string): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    const key = `ratelimit:${userId}:${operation}`;
    await redisClient.del(key);

    console.log('[RateLimiter] Rate limit reset', { userId, operation });
  } catch (error) {
    console.error('[RateLimiter] Error resetting rate limit', { error, userId, operation });
  }
}
