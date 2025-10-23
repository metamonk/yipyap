/**
 * Retry Queue Service for handling failed operations with exponential backoff
 * Provides persistent queue storage and automatic retry logic with circuit breaker
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';

/**
 * Represents an item in the retry queue
 * @interface RetryQueueItem
 */
export interface RetryQueueItem {
  /** Unique identifier for the operation */
  id: string;

  /** Type of operation being retried */
  operationType: 'READ_RECEIPT_BATCH' | 'MESSAGE_SEND' | 'STATUS_UPDATE' | 'CONVERSATION_CREATE';

  /** Operation-specific data payload */
  data: {
    messageIds?: string[];
    userId?: string;
    timestamp?: Timestamp;
    [key: string]: unknown;
  };

  /** Number of retry attempts made */
  retryCount: number;

  /** Timestamp (ms) when next retry should be attempted */
  nextRetryTime: number;

  /** Timestamp (ms) when item was created */
  createdAt: number;

  /** Last error message encountered */
  lastError?: string;
}

/**
 * Configuration for retry behavior
 * @interface RetryConfig
 */
export interface RetryConfig {
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;

  /** Array of backoff delays in milliseconds */
  backoffDelays: number[];

  /** Maximum items allowed in queue */
  maxQueueSize: number;

  /** Enable/disable circuit breaker */
  enableCircuitBreaker: boolean;

  /** Number of consecutive failures to trigger circuit breaker */
  circuitBreakerThreshold: number;

  /** Circuit breaker cool-down period in ms */
  circuitBreakerCooldown: number;
}

/**
 * Default configuration for retry behavior
 */
const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  backoffDelays: [1000, 2000, 4000, 8000, 16000, 30000],
  maxQueueSize: 100,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 10,
  circuitBreakerCooldown: 60000, // 1 minute
};

/**
 * Service for managing retry operations with exponential backoff and persistent storage
 * @class RetryQueue
 * @remarks
 * Implements a persistent retry queue with exponential backoff, circuit breaker pattern,
 * and automatic recovery on app restart
 *
 * @example
 * ```typescript
 * const retryQueue = RetryQueue.getInstance();
 * await retryQueue.enqueue({
 *   operationType: 'READ_RECEIPT_BATCH',
 *   data: { messageIds: ['msg1', 'msg2'], userId: 'user123' }
 * });
 * ```
 */
export class RetryQueue {
  private static instance: RetryQueue;
  private queue: Map<string, RetryQueueItem> = new Map();
  private config: RetryConfig;
  private isProcessing: boolean = false;
  private circuitBreakerActive: boolean = false;
  private consecutiveFailures: number = 0;
  private circuitBreakerResetTime: number = 0;
  private processors: Map<string, (item: RetryQueueItem) => Promise<boolean>> = new Map();

  private readonly STORAGE_KEY = '@yipyap:retry_queue';

  /**
   * Private constructor to enforce singleton pattern
   * @param config - Optional custom configuration
   */
  private constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadQueue();
  }

  /**
   * Gets the singleton instance of RetryQueue
   * @param config - Optional custom configuration (only used on first call)
   * @returns The RetryQueue singleton instance
   */
  public static getInstance(config?: Partial<RetryConfig>): RetryQueue {
    if (!RetryQueue.instance) {
      RetryQueue.instance = new RetryQueue(config);
    }
    return RetryQueue.instance;
  }

  /**
   * Registers a processor function for a specific operation type
   * @param operationType - Type of operation to process
   * @param processor - Function that processes the operation, returns true on success
   * @example
   * ```typescript
   * retryQueue.registerProcessor('READ_RECEIPT_BATCH', async (item) => {
   *   // Process the item
   *   return true; // Return true on success, false on failure
   * });
   * ```
   */
  public registerProcessor(
    operationType: string,
    processor: (item: RetryQueueItem) => Promise<boolean>
  ): void {
    this.processors.set(operationType, processor);
  }

  /**
   * Adds an operation to the retry queue
   * @param operation - Operation details without id, retryCount, or timestamps
   * @returns The created queue item ID
   * @throws {Error} When queue size limit is exceeded
   */
  public async enqueue(operation: {
    operationType: RetryQueueItem['operationType'];
    data: RetryQueueItem['data'];
  }): Promise<string> {
    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error(`Queue size limit (${this.config.maxQueueSize}) exceeded`);
    }

    const id = this.generateOperationId(operation);
    const queueItem: RetryQueueItem = {
      id,
      ...operation,
      retryCount: 0,
      nextRetryTime: Date.now(),
      createdAt: Date.now(),
    };

    this.queue.set(id, queueItem);
    await this.persistQueue();

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Removes an item from the queue
   * @param id - The item ID to remove
   * @returns True if item was removed, false if not found
   */
  public async dequeue(id: string): Promise<boolean> {
    const removed = this.queue.delete(id);
    if (removed) {
      await this.persistQueue();
    }
    return removed;
  }

  /**
   * Processes the queue, retrying items that are due
   * Automatically called when items are enqueued
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      // Check circuit breaker
      if (this.circuitBreakerActive && Date.now() < this.circuitBreakerResetTime) {
        return;
      } else if (this.circuitBreakerActive) {
        // Reset circuit breaker
        this.circuitBreakerActive = false;
        this.consecutiveFailures = 0;
      }

      const now = Date.now();
      const itemsToProcess = Array.from(this.queue.values())
        .filter(item => item.nextRetryTime <= now)
        .sort((a, b) => a.nextRetryTime - b.nextRetryTime);

      for (const item of itemsToProcess) {
        await this.processItem(item);
      }
    } finally {
      this.isProcessing = false;

      // Schedule next processing if there are items in queue
      if (this.queue.size > 0) {
        const nextItem = Array.from(this.queue.values())
          .sort((a, b) => a.nextRetryTime - b.nextRetryTime)[0];

        if (nextItem) {
          const delay = Math.max(0, nextItem.nextRetryTime - Date.now());
          setTimeout(() => this.processQueue(), delay);
        }
      }
    }
  }

  /**
   * Process a single queue item
   * @param item - The item to process
   */
  private async processItem(item: RetryQueueItem): Promise<void> {
    const processor = this.processors.get(item.operationType);

    if (!processor) {
      console.warn(`No processor registered for operation type: ${item.operationType}`);
      return;
    }

    try {
      const success = await processor(item);

      if (success) {
        // Success - remove from queue
        await this.dequeue(item.id);
        this.consecutiveFailures = 0;
      } else {
        // Failure - schedule retry
        await this.handleFailure(item);
      }
    } catch (error) {
      // Error - schedule retry
      item.lastError = error instanceof Error ? error.message : 'Unknown error';
      await this.handleFailure(item);
    }
  }

  /**
   * Handles a failed operation by scheduling retry or removing if max retries exceeded
   * @param item - The failed item
   */
  private async handleFailure(item: RetryQueueItem): Promise<void> {
    item.retryCount++;
    this.consecutiveFailures++;

    // Check if max retries exceeded
    if (item.retryCount >= this.config.maxRetries) {
      console.error(
        `Max retries (${this.config.maxRetries}) exceeded for operation ${item.id}`,
        item.lastError
      );
      await this.dequeue(item.id);
      return;
    }

    // Calculate next retry time with exponential backoff
    const backoffIndex = Math.min(
      item.retryCount - 1,
      this.config.backoffDelays.length - 1
    );
    const backoffDelay = this.config.backoffDelays[backoffIndex];
    item.nextRetryTime = Date.now() + backoffDelay;

    // Update queue
    this.queue.set(item.id, item);
    await this.persistQueue();

    // Check circuit breaker
    if (
      this.config.enableCircuitBreaker &&
      this.consecutiveFailures >= this.config.circuitBreakerThreshold
    ) {
      this.activateCircuitBreaker();
    }
  }

  /**
   * Activates the circuit breaker to prevent overwhelming the system
   */
  private activateCircuitBreaker(): void {
    this.circuitBreakerActive = true;
    this.circuitBreakerResetTime = Date.now() + this.config.circuitBreakerCooldown;
    console.warn(
      `Circuit breaker activated after ${this.consecutiveFailures} consecutive failures. ` +
      `Will reset at ${new Date(this.circuitBreakerResetTime).toISOString()}`
    );
  }

  /**
   * Generates a unique operation ID based on operation data
   * @param operation - The operation to generate ID for
   * @returns A unique operation ID
   */
  private generateOperationId(operation: {
    operationType: string;
    data: unknown;
  }): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const dataHash = this.simpleHash(JSON.stringify(operation.data));
    return `${operation.operationType}_${timestamp}_${dataHash}_${random}`;
  }

  /**
   * Simple hash function for generating operation IDs
   * @param str - String to hash
   * @returns Hash string
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Persists the queue to AsyncStorage
   */
  private async persistQueue(): Promise<void> {
    try {
      const queueArray = Array.from(this.queue.values());
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueArray));
    } catch (error) {
      console.error('Failed to persist retry queue:', error);
    }
  }

  /**
   * Loads the queue from AsyncStorage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const queueArray: RetryQueueItem[] = JSON.parse(stored);
        this.queue.clear();
        queueArray.forEach(item => {
          this.queue.set(item.id, item);
        });

        // Start processing loaded queue
        if (this.queue.size > 0) {
          this.processQueue();
        }
      }
    } catch (error) {
      console.error('Failed to load retry queue:', error);
    }
  }

  /**
   * Clears the entire queue
   * @returns Promise that resolves when queue is cleared
   */
  public async clear(): Promise<void> {
    this.queue.clear();
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Gets the current queue size
   * @returns Number of items in the queue
   */
  public getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Gets all items in the queue
   * @returns Array of queue items
   */
  public getQueueItems(): RetryQueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Checks if circuit breaker is active
   * @returns True if circuit breaker is active
   */
  public isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }
}

// Export singleton instance getter for convenience
export const getRetryQueue = RetryQueue.getInstance;