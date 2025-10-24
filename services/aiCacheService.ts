/**
 * AI Cache Service
 *
 * @module services/aiCacheService
 * @description
 * Provides caching for AI operation results to reduce costs and improve latency.
 * Uses content-based hashing for cache keys.
 * Implements TTL (Time To Live) expiration for cache entries.
 * Tracks cache metrics for optimization analysis.
 */

import { getFirestore, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './firebase';

/**
 * Default cache TTL in milliseconds (1 hour)
 */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Cache TTL by operation type (in milliseconds)
 */
const CACHE_TTL_BY_OPERATION = {
  categorization: 24 * 60 * 60 * 1000, // 24 hours
  sentiment: 24 * 60 * 60 * 1000, // 24 hours
  faq_detection: 7 * 24 * 60 * 60 * 1000, // 7 days
  voice_matching: 30 * 60 * 1000, // 30 minutes (fresher responses)
  opportunity_scoring: 24 * 60 * 60 * 1000, // 24 hours
  daily_agent: 0, // Never cache (always fresh)
} as const;

/**
 * Cached AI operation result
 */
interface CachedResult {
  /** Cache key (content hash) */
  key: string;

  /** Operation type */
  operation: string;

  /** Cached result data */
  result: string;

  /** Timestamp when cache entry was created */
  cachedAt: Timestamp;

  /** Timestamp when cache entry expires */
  expiresAt: Timestamp;

  /** Number of times this cache entry has been hit */
  hitCount: number;

  /** Timestamp of last cache hit */
  lastHitAt?: Timestamp;
}

/**
 * Gets the Firestore instance using lazy initialization
 * @returns Firestore instance
 */
const getDb = () => {
  return getFirestore(getFirebaseApp());
};

/**
 * Generate a deterministic cache key from content
 *
 * @param content - Content to hash (e.g., message text)
 * @param operation - Operation type
 * @returns Cache key string
 *
 * @remarks
 * Uses simple string-based hashing for deterministic keys.
 * For production, consider using crypto.subtle.digest() for better hashing.
 * Keys are prefixed with operation type for namespacing.
 *
 * @example
 * ```typescript
 * const key = generateCacheKey('Hello world!', 'categorization');
 * console.log(key); // 'categorization_<hash>'
 * ```
 */
export function generateCacheKey(content: string, operation: string): string {
  // Simple hash function (for production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const hashStr = Math.abs(hash).toString(36);
  return `${operation}_${hashStr}`;
}

/**
 * Get cached result for an AI operation
 *
 * @param cacheKey - Cache key to lookup
 * @param userId - User ID (for scoping cache to user)
 * @returns Cached result or null if not found/expired
 *
 * @remarks
 * Checks TTL and returns null for expired entries.
 * Updates hitCount and lastHitAt on cache hit.
 * Non-blocking to avoid impacting AI operations.
 *
 * @example
 * ```typescript
 * const key = generateCacheKey(messageText, 'categorization');
 * const cached = await getCachedResult(key, 'user123');
 * if (cached) {
 *   console.log('Cache hit!', cached.result);
 * }
 * ```
 */
export async function getCachedResult(cacheKey: string, userId: string): Promise<unknown | null> {
  try {
    // Authentication guard - only read cache if authenticated user matches target
    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== userId) {
      // Graceful degradation - cache miss, operation will proceed without cache
      return null;
    }

    const db = getDb();
    const cacheRef = doc(db, `users/${userId}/ai_cache`, cacheKey);
    const cacheDoc = await getDoc(cacheRef);

    if (!cacheDoc.exists()) {
      return null;
    }

    const cached = cacheDoc.data() as CachedResult;

    // Check if expired
    const now = Date.now();
    const expiresAt = cached.expiresAt.toMillis();

    if (now >= expiresAt) {
      // Cache expired
      return null;
    }

    // Update hit count (fire and forget - don't block on this)
    setDoc(
      cacheRef,
      {
        hitCount: (cached.hitCount || 0) + 1,
        lastHitAt: Timestamp.now(),
      },
      { merge: true }
    ).catch((error) => {
      console.error('[aiCacheService] Failed to update hit count:', error);
    });

    // Deserialize result from JSON string
    try {
      return JSON.parse(cached.result);
    } catch {
      // If not a JSON string (legacy data), return as-is
      return cached.result;
    }
  } catch (error) {
    console.error('[aiCacheService] Failed to get cached result:', error);
    return null;
  }
}

/**
 * Store result in cache
 *
 * @param cacheKey - Cache key
 * @param userId - User ID (for scoping cache to user)
 * @param operation - Operation type
 * @param result - Result to cache
 * @param ttlMs - Optional TTL in milliseconds (defaults to operation-specific TTL)
 *
 * @remarks
 * Sets expiration time based on operation type.
 * Non-blocking to avoid impacting AI operations.
 * Fails silently to avoid breaking AI functionality.
 *
 * @example
 * ```typescript
 * const key = generateCacheKey(messageText, 'categorization');
 * await setCachedResult(key, 'user123', 'categorization', {
 *   category: 'fan_engagement',
 *   confidence: 0.95
 * });
 * ```
 */
export async function setCachedResult(
  cacheKey: string,
  userId: string,
  operation: keyof typeof CACHE_TTL_BY_OPERATION,
  result: unknown,
  ttlMs?: number
): Promise<void> {
  try {
    // Authentication guard - only write cache if authenticated user matches target
    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== userId) {
      // Graceful degradation - silently skip caching
      return;
    }

    // Don't cache if TTL is 0 (e.g., daily_agent operations)
    const ttl =
      ttlMs !== undefined
        ? ttlMs
        : CACHE_TTL_BY_OPERATION[operation] !== undefined
          ? CACHE_TTL_BY_OPERATION[operation]
          : DEFAULT_CACHE_TTL_MS;

    if (ttl === 0) {
      return;
    }

    const db = getDb();
    const cacheRef = doc(db, `users/${userId}/ai_cache`, cacheKey);

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(Date.now() + ttl);

    // Serialize result to JSON string to avoid Firestore nested array issues
    const serializedResult = JSON.stringify(result);

    const cachedResult: CachedResult = {
      key: cacheKey,
      operation,
      result: serializedResult, // Store as JSON string
      cachedAt: now,
      expiresAt,
      hitCount: 0,
    };

    // Non-blocking write (fire and forget)
    setDoc(cacheRef, cachedResult).catch((error) => {
      console.error('[aiCacheService] Failed to cache result:', error);
    });
  } catch (error) {
    console.error('[aiCacheService] Failed to set cached result:', error);
  }
}

/**
 * Clear expired cache entries for a user
 *
 * @param userId - User ID
 *
 * @remarks
 * This is a maintenance operation that should be run periodically.
 * In production, use a Cloud Function scheduled job for this.
 * For now, it's a manual operation.
 *
 * @example
 * ```typescript
 * await clearExpiredCache('user123');
 * ```
 */
export async function clearExpiredCache(userId: string): Promise<void> {
  // TODO: Implement with batch delete
  // This would require querying all cache entries and deleting expired ones
  // For MVP, relying on TTL checks during getCachedResult()
  console.log(`[aiCacheService] clearExpiredCache not yet implemented for user ${userId}`);
}

/**
 * Check if caching is enabled for an operation
 *
 * @param operation - Operation type
 * @returns True if caching is enabled (TTL > 0)
 *
 * @example
 * ```typescript
 * if (isCachingEnabled('categorization')) {
 *   const cached = await getCachedResult(key, userId);
 * }
 * ```
 */
export function isCachingEnabled(operation: keyof typeof CACHE_TTL_BY_OPERATION): boolean {
  return CACHE_TTL_BY_OPERATION[operation] > 0;
}
