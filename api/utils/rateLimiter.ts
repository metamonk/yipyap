import { Redis } from '@upstash/redis';

/**
 * Rate limit result indicating whether request is allowed
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Timestamp when rate limit resets (Unix timestamp in seconds) */
  resetAt: number;
  /** Total limit for the window */
  limit: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Default rate limit: 100 requests per hour per user
 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequests: 100,
  windowSeconds: 3600, // 1 hour
};

/**
 * Edge-compatible rate limiter using Upstash Redis
 * Implements sliding window algorithm for accurate rate limiting
 *
 * @class RateLimiter
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   url: process.env.UPSTASH_REDIS_REST_URL!,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 * });
 *
 * const result = await limiter.checkLimit('user123');
 * if (!result.allowed) {
 *   return new Response('Rate limit exceeded', { status: 429 });
 * }
 * ```
 */
export class RateLimiter {
  private redis: Redis;
  private config: RateLimiterConfig;

  /**
   * Creates a new RateLimiter instance
   *
   * @param redisConfig - Upstash Redis connection configuration
   * @param rateLimitConfig - Optional rate limit configuration (defaults to 100 req/hour)
   */
  constructor(
    redisConfig: { url: string; token: string },
    rateLimitConfig: RateLimiterConfig = DEFAULT_CONFIG
  ) {
    this.redis = new Redis({
      url: redisConfig.url,
      token: redisConfig.token,
    });
    this.config = rateLimitConfig;
  }

  /**
   * Check if a request is allowed under rate limits
   * Uses sliding window algorithm for accurate limiting
   *
   * @param userId - Unique identifier for the user (typically user ID or IP)
   * @returns Promise resolving to rate limit result
   *
   * @example
   * ```typescript
   * const result = await rateLimiter.checkLimit('user_abc123');
   * if (!result.allowed) {
   *   console.log(`Rate limit exceeded. Try again at ${new Date(result.resetAt * 1000)}`);
   * }
   * ```
   */
  async checkLimit(userId: string): Promise<RateLimitResult> {
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowSeconds * 1000;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the sliding window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      pipeline.zcard(key);

      // Add current request timestamp
      pipeline.zadd(key, { score: now, member: `${now}` });

      // Set expiry on the key (cleanup)
      pipeline.expire(key, this.config.windowSeconds);

      // Execute pipeline
      const results = await pipeline.exec();

      // Extract count from pipeline results
      // results[1] is the zcard result (count of items in window)
      const count = (results[1] as number) || 0;

      const allowed = count < this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - count - 1);
      const resetAt = Math.ceil((now + this.config.windowSeconds * 1000) / 1000);

      return {
        allowed,
        remaining,
        resetAt,
        limit: this.config.maxRequests,
      };
    } catch (error) {
      // On Redis error, fail open (allow request) to avoid blocking legitimate users
      // Log error for monitoring
      console.error('Rate limiter error:', error);

      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: Math.ceil((now + this.config.windowSeconds * 1000) / 1000),
        limit: this.config.maxRequests,
      };
    }
  }

  /**
   * Reset rate limit for a specific user
   * Useful for testing or admin operations
   *
   * @param userId - User ID to reset
   * @returns Promise resolving when reset is complete
   *
   * @example
   * ```typescript
   * await rateLimiter.reset('user_abc123');
   * ```
   */
  async reset(userId: string): Promise<void> {
    const key = `ratelimit:${userId}`;
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      throw new Error('Rate limit reset failed');
    }
  }

  /**
   * Get current rate limit status for a user without incrementing
   * Useful for checking limits before expensive operations
   *
   * @param userId - User ID to check
   * @returns Promise resolving to rate limit result
   *
   * @example
   * ```typescript
   * const status = await rateLimiter.getStatus('user_abc123');
   * console.log(`${status.remaining} requests remaining`);
   * ```
   */
  async getStatus(userId: string): Promise<RateLimitResult> {
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowSeconds * 1000;

    try {
      // Remove old entries and count
      await this.redis.zremrangebyscore(key, 0, windowStart);
      const count = await this.redis.zcard(key);

      const allowed = count < this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - count);
      const resetAt = Math.ceil((now + this.config.windowSeconds * 1000) / 1000);

      return {
        allowed,
        remaining,
        resetAt,
        limit: this.config.maxRequests,
      };
    } catch (error) {
      console.error('Rate limiter status check error:', error);

      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: Math.ceil((now + this.config.windowSeconds * 1000) / 1000),
        limit: this.config.maxRequests,
      };
    }
  }
}

/**
 * Create a rate limiter instance with environment variables
 * Convenience function for common use case
 *
 * @returns RateLimiter instance configured with Upstash credentials
 * @throws {Error} If required environment variables are missing
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter();
 * const result = await limiter.checkLimit(userId);
 * ```
 */
export function createRateLimiter(
  config?: RateLimiterConfig
): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing required environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'
    );
  }

  return new RateLimiter({ url, token }, config);
}
