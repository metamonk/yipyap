/**
 * Idempotency helpers for preventing duplicate operations
 *
 * @remarks
 * Provides deduplication logic using LRU cache with TTL to ensure
 * operations are not processed multiple times. Critical for preventing
 * duplicate read receipt updates and maintaining data consistency.
 */

/**
 * Cache entry for tracking processed operations
 * @interface CacheEntry
 */
interface CacheEntry {
  /** Unique operation ID hash */
  id: string;

  /** Timestamp when entry was created */
  createdAt: number;

  /** Optional result data from operation */
  result?: unknown;

  /** Number of times this operation was attempted */
  attemptCount: number;
}

/**
 * Configuration for idempotency cache
 * @interface IdempotencyConfig
 */
export interface IdempotencyConfig {
  /** Maximum number of entries in cache (default: 1000) */
  maxSize: number;

  /** Time-to-live for cache entries in milliseconds (default: 300000 = 5 minutes) */
  ttl: number;

  /** Whether to store operation results in cache (default: false) */
  storeResults: boolean;
}

/**
 * LRU cache implementation for idempotent operation tracking
 * @class IdempotencyCache
 *
 * @remarks
 * Implements a Least Recently Used cache with time-based expiration.
 * Thread-safe for React Native's single-threaded environment.
 *
 * @example
 * ```typescript
 * const cache = IdempotencyCache.getInstance();
 *
 * const operationId = cache.generateOperationId({
 *   type: 'READ_RECEIPT',
 *   messageIds: ['msg1', 'msg2'],
 *   userId: 'user123'
 * });
 *
 * if (!cache.hasProcessed(operationId)) {
 *   // Process operation
 *   cache.markProcessed(operationId);
 * }
 * ```
 */
export class IdempotencyCache {
  private static instance: IdempotencyCache;
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];
  private config: IdempotencyConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Default configuration values
   */
  private static readonly DEFAULT_CONFIG: IdempotencyConfig = {
    maxSize: 1000,
    ttl: 300000, // 5 minutes
    storeResults: false,
  };

  /**
   * Private constructor to enforce singleton pattern
   * @param config - Optional custom configuration
   */
  private constructor(config?: Partial<IdempotencyConfig>) {
    this.config = { ...IdempotencyCache.DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.accessOrder = [];
    this.startCleanupTimer();
  }

  /**
   * Gets the singleton instance of IdempotencyCache
   * @param config - Optional configuration (only used on first call)
   * @returns The IdempotencyCache singleton instance
   */
  public static getInstance(config?: Partial<IdempotencyConfig>): IdempotencyCache {
    if (!IdempotencyCache.instance) {
      IdempotencyCache.instance = new IdempotencyCache(config);
    }
    return IdempotencyCache.instance;
  }

  /**
   * Generates a unique operation ID by hashing operation data
   * @param data - Operation data to hash
   * @returns String hash
   *
   * @remarks
   * Uses a deterministic hash function compatible with React Native to create
   * consistent IDs from operation data. Same input will always produce
   * same hash, enabling deduplication.
   *
   * @example
   * ```typescript
   * const id = cache.generateOperationId({
   *   type: 'UPDATE',
   *   messageIds: ['msg1', 'msg2'],
   *   userId: 'user123'
   * });
   * // Returns: "12345678abcd..."
   * ```
   */
  public generateOperationId(data: unknown): string {
    // Sort object keys for consistent hashing
    const normalizedData = this.normalizeData(data);
    const jsonString = JSON.stringify(normalizedData);

    // Create a deterministic hash compatible with React Native
    // Using djb2 hash algorithm which is simple and effective
    let hash = 5381;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) + hash) + char; // hash * 33 + char
      hash = hash & hash; // Convert to 32bit integer
    }

    // Convert to positive hexadecimal string
    // This ensures consistent output for the same input
    return Math.abs(hash).toString(16);
  }

  /**
   * Normalizes data object for consistent hashing
   * @param data - Data to normalize
   * @returns Normalized data with sorted keys
   */
  private normalizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      // Sort arrays for consistency
      return data.map(item => this.normalizeData(item)).sort();
    }

    if (typeof data === 'object') {
      // Sort object keys
      const sorted: Record<string, unknown> = {};
      Object.keys(data)
        .sort()
        .forEach(key => {
          sorted[key] = this.normalizeData(data[key]);
        });
      return sorted;
    }

    return data;
  }

  /**
   * Checks if an operation has already been processed
   * @param operationId - The operation ID to check
   * @returns True if operation was processed, false otherwise
   *
   * @example
   * ```typescript
   * if (cache.hasProcessed(operationId)) {
   *   console.log('Operation already processed, skipping');
   *   return;
   * }
   * ```
   */
  public hasProcessed(operationId: string): boolean {
    const entry = this.cache.get(operationId);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.remove(operationId);
      return false;
    }

    // Update access order (LRU)
    this.updateAccessOrder(operationId);

    return true;
  }

  /**
   * Marks an operation as processed
   * @param operationId - The operation ID to mark
   * @param result - Optional result data to store
   * @returns True if newly marked, false if already existed
   *
   * @example
   * ```typescript
   * const isNew = cache.markProcessed(operationId, { success: true });
   * if (!isNew) {
   *   console.log('Operation was already in cache');
   * }
   * ```
   */
  public markProcessed(operationId: string, result?: unknown): boolean {
    const existingEntry = this.cache.get(operationId);

    if (existingEntry && !this.isExpired(existingEntry)) {
      // Already exists - just increment attempt count
      existingEntry.attemptCount++;
      this.updateAccessOrder(operationId);
      return false;
    }

    // Enforce size limit (LRU eviction)
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    // Create new entry
    const entry: CacheEntry = {
      id: operationId,
      createdAt: Date.now(),
      result: this.config.storeResults ? result : undefined,
      attemptCount: 1,
    };

    this.cache.set(operationId, entry);
    this.accessOrder.push(operationId);

    return true;
  }

  /**
   * Gets the result of a previously processed operation
   * @param operationId - The operation ID
   * @returns The stored result, or undefined if not found/expired
   */
  public getResult(operationId: string): unknown {
    const entry = this.cache.get(operationId);

    if (!entry || this.isExpired(entry)) {
      return undefined;
    }

    this.updateAccessOrder(operationId);
    return entry.result;
  }

  /**
   * Checks if a cache entry has expired
   * @param entry - The cache entry to check
   * @returns True if expired, false otherwise
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > this.config.ttl;
  }

  /**
   * Updates the access order for LRU tracking
   * @param operationId - The operation ID that was accessed
   */
  private updateAccessOrder(operationId: string): void {
    const index = this.accessOrder.indexOf(operationId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(operationId);
  }

  /**
   * Evicts the least recently used entry
   */
  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;

    const oldestId = this.accessOrder.shift();
    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }

  /**
   * Removes a specific entry from cache
   * @param operationId - The operation ID to remove
   */
  private remove(operationId: string): void {
    this.cache.delete(operationId);
    const index = this.accessOrder.indexOf(operationId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Clears all entries from the cache
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Gets the current cache size
   * @returns Number of entries in cache
   */
  public getSize(): number {
    return this.cache.size;
  }

  /**
   * Gets cache statistics
   * @returns Object with cache metrics
   */
  public getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    oldestEntryAge: number | null;
  } {
    let oldestAge = null;

    if (this.accessOrder.length > 0) {
      const oldestId = this.accessOrder[0];
      const entry = this.cache.get(oldestId);
      if (entry) {
        oldestAge = Date.now() - entry.createdAt;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      oldestEntryAge: oldestAge,
    };
  }

  /**
   * Starts periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    // Run cleanup every minute
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  /**
   * Removes all expired entries from cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.cache.forEach((entry, id) => {
      if (now - entry.createdAt > this.config.ttl) {
        expiredIds.push(id);
      }
    });

    expiredIds.forEach(id => this.remove(id));

    if (expiredIds.length > 0 && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console -- Development-only logging
      console.log(`Cleaned up ${expiredIds.length} expired cache entries`);
    }
  }

  /**
   * Stops the cleanup timer (for cleanup)
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Export singleton getter for convenience
export const getIdempotencyCache = IdempotencyCache.getInstance;

/**
 * Higher-order function to make any async operation idempotent
 *
 * @param operation - The async operation to make idempotent
 * @param getOperationId - Function to generate operation ID from arguments
 * @returns Wrapped function that ensures idempotency
 *
 * @example
 * ```typescript
 * const idempotentUpdate = makeIdempotent(
 *   async (messageId: string, status: string) => {
 *     // Update logic here
 *   },
 *   (messageId, status) => ({ messageId, status })
 * );
 *
 * // Multiple calls with same args will only execute once
 * await idempotentUpdate('msg123', 'read');
 * await idempotentUpdate('msg123', 'read'); // Skipped
 * ```
 */
export function makeIdempotent<T extends unknown[], R>(
  operation: (...args: T) => Promise<R>,
  getOperationData: (...args: T) => unknown
): (...args: T) => Promise<R> {
  const cache = getIdempotencyCache({ storeResults: true });

  return async (...args: T): Promise<R> => {
    const operationData = getOperationData(...args);
    const operationId = cache.generateOperationId(operationData);

    // Check if already processed
    if (cache.hasProcessed(operationId)) {
      const cachedResult = cache.getResult(operationId);
      if (cachedResult !== undefined) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console -- Development-only logging
          console.log('Operation deduplicated, returning cached result');
        }
        return cachedResult as R;
      }
    }

    // Execute operation
    const result = await operation(...args);
    cache.markProcessed(operationId, result);
    return result;
  };
}

/**
 * Decorator for making class methods idempotent
 *
 * @param getOperationData - Function to extract operation data from method arguments
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class MessageService {
 *   @Idempotent((conversationId, messageIds) => ({ conversationId, messageIds }))
 *   async markAsRead(conversationId: string, messageIds: string[]) {
 *     // Implementation
 *   }
 * }
 * ```
 */
export function Idempotent(getOperationData: (...args: unknown[]) => unknown) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = makeIdempotent(originalMethod, getOperationData);

    return descriptor;
  };
}