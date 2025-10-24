/**
 * AI service initialization
 * @module functions/src/ai/initialize
 *
 * @remarks
 * This module initializes all AI infrastructure services.
 * Should be called once during Cloud Function cold start.
 */

import { initLangfuse } from './monitoring';
import { initRateLimiter } from './rateLimiter';

/**
 * Initializes all AI services
 *
 * @remarks
 * Call this once during Cloud Function initialization to set up:
 * - Langfuse monitoring client
 * - Upstash Redis rate limiter
 *
 * Services gracefully degrade if credentials are not provided.
 *
 * @example
 * ```typescript
 * // In your Cloud Function entry point
 * import { initializeAI } from './ai/initialize';
 *
 * // Initialize on cold start
 * initializeAI();
 *
 * // Then use AI services
 * export const myFunction = onRequest(async (req, res) => {
 *   const aiService = new AIService(...);
 *   // ...
 * });
 * ```
 */
export function initializeAI(): void {
  console.log('[AI] Initializing AI services...');

  // Initialize monitoring (Langfuse)
  const langfuseInitialized = initLangfuse(
    process.env.LANGFUSE_PUBLIC_KEY,
    process.env.LANGFUSE_SECRET_KEY,
    process.env.LANGFUSE_BASE_URL
  );

  // Initialize rate limiting (Upstash Redis)
  const rateLimiterInitialized = initRateLimiter(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  console.log('[AI] Initialization complete', {
    langfuse: langfuseInitialized ? 'enabled' : 'disabled',
    rateLimiter: rateLimiterInitialized ? 'enabled' : 'disabled',
  });
}
