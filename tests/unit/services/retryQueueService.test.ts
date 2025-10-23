/**
 * Unit tests for RetryQueue service
 * Tests exponential backoff, queue persistence, circuit breaker, and retry logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RetryQueue, RetryQueueItem, RetryConfig } from '@/services/retryQueueService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock timers for testing
jest.useFakeTimers();

describe('RetryQueue Service', () => {
  let retryQueue: RetryQueue;
  const mockProcessor = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Create new instance for each test
    // @ts-expect-error - Reset singleton for testing
    RetryQueue.instance = undefined;
    retryQueue = RetryQueue.getInstance();

    // Register a mock processor
    retryQueue.registerProcessor('READ_RECEIPT_BATCH', mockProcessor);
  });

  afterEach(async () => {
    await retryQueue.clear();
  });

  describe('Exponential Backoff Calculation', () => {
    it('should calculate correct backoff delays for each retry', async () => {
      const delays: number[] = [];
      let attemptCount = 0;

      // Mock processor that fails and captures retry timing
      const failingProcessor = jest.fn().mockImplementation((item: RetryQueueItem) => {
        attemptCount++;
        if (attemptCount <= 3) {
          // Capture the delay until next retry
          const now = Date.now();
          if (item.nextRetryTime > now) {
            delays.push(item.nextRetryTime - now);
          }
          return Promise.resolve(false); // Fail to trigger retry
        }
        return Promise.resolve(true); // Success on 4th attempt
      });

      retryQueue.registerProcessor('READ_RECEIPT_BATCH', failingProcessor);

      // Enqueue an operation
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });

      // Process queue multiple times to trigger retries
      await retryQueue.processQueue();
      jest.advanceTimersByTime(1000); // First backoff
      await retryQueue.processQueue();
      jest.advanceTimersByTime(2000); // Second backoff
      await retryQueue.processQueue();
      jest.advanceTimersByTime(4000); // Third backoff
      await retryQueue.processQueue();

      // Verify exponential backoff pattern (approximately)
      expect(delays.length).toBeGreaterThan(0);
      // Each delay should be roughly double the previous (within tolerance)
      for (let i = 1; i < delays.length; i++) {
        const ratio = delays[i] / delays[i - 1];
        expect(ratio).toBeGreaterThanOrEqual(1.5);
        expect(ratio).toBeLessThanOrEqual(2.5);
      }
    });

    it('should not exceed maximum backoff delay', async () => {
      const config: Partial<RetryConfig> = {
        maxRetries: 10,
        backoffDelays: [1000, 2000, 4000, 8000, 16000, 30000], // Max 30 seconds
      };

      // @ts-expect-error - Reset singleton for custom config
      RetryQueue.instance = undefined;
      retryQueue = RetryQueue.getInstance(config);

      let maxDelay = 0;
      const processor = jest.fn().mockImplementation((item: RetryQueueItem) => {
        const delay = item.nextRetryTime - Date.now();
        maxDelay = Math.max(maxDelay, delay);
        return Promise.resolve(false);
      });

      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });

      // Trigger multiple retries
      for (let i = 0; i < 8; i++) {
        await retryQueue.processQueue();
        jest.advanceTimersByTime(30000);
      }

      // Max delay should not exceed 30 seconds (30000ms)
      expect(maxDelay).toBeLessThanOrEqual(30000);
    });
  });

  describe('Queue Persistence', () => {
    it('should persist queue to AsyncStorage', async () => {
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1', 'msg2'], userId: 'user1' },
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@yipyap:retry_queue',
        expect.stringContaining('READ_RECEIPT_BATCH')
      );
    });

    it('should load queue from AsyncStorage on initialization', async () => {
      const storedQueue: RetryQueueItem[] = [
        {
          id: 'test_123',
          operationType: 'READ_RECEIPT_BATCH',
          data: { messageIds: ['msg1'], userId: 'user1' },
          retryCount: 2,
          nextRetryTime: Date.now() + 5000,
          createdAt: Date.now() - 10000,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedQueue)
      );

      // Create new instance to trigger load
      // @ts-expect-error - Reset singleton
      RetryQueue.instance = undefined;
      const newQueue = RetryQueue.getInstance();

      // Give async load time to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(newQueue.getQueueSize()).toBe(1);
      const items = newQueue.getQueueItems();
      expect(items[0].id).toBe('test_123');
      expect(items[0].retryCount).toBe(2);
    });

    it('should handle corrupted storage gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid json{');

      // Create new instance to trigger load
      // @ts-expect-error - Reset singleton
      RetryQueue.instance = undefined;
      const newQueue = RetryQueue.getInstance();

      // Give async load time to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should start with empty queue on error
      expect(newQueue.getQueueSize()).toBe(0);
    });
  });

  describe('Maximum Retry Limit', () => {
    it('should stop retrying after max retries exceeded', async () => {
      const config: Partial<RetryConfig> = {
        maxRetries: 3,
        backoffDelays: [100, 200, 400],
      };

      // @ts-expect-error - Reset singleton
      RetryQueue.instance = undefined;
      retryQueue = RetryQueue.getInstance(config);

      const processor = jest.fn().mockResolvedValue(false); // Always fail
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });

      // Process multiple times
      for (let i = 0; i < 5; i++) {
        await retryQueue.processQueue();
        jest.advanceTimersByTime(1000);
      }

      // Should be called exactly 3 times (max retries)
      expect(processor).toHaveBeenCalledTimes(3);

      // Item should be removed from queue after max retries
      expect(retryQueue.getQueueSize()).toBe(0);
    });

    it('should remove item from queue on successful processing', async () => {
      const processor = jest.fn().mockResolvedValue(true); // Success
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });

      expect(retryQueue.getQueueSize()).toBe(1);

      await retryQueue.processQueue();

      expect(processor).toHaveBeenCalledTimes(1);
      expect(retryQueue.getQueueSize()).toBe(0);
    });
  });

  describe('Queue Processing Order (FIFO)', () => {
    it('should process items in FIFO order', async () => {
      const processOrder: string[] = [];
      const processor = jest.fn().mockImplementation((item: RetryQueueItem) => {
        processOrder.push(item.data.messageIds[0]);
        return Promise.resolve(true);
      });

      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      // Enqueue multiple items
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['first'], userId: 'user1' },
      });
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['second'], userId: 'user1' },
      });
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['third'], userId: 'user1' },
      });

      await retryQueue.processQueue();

      expect(processOrder).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Circuit Breaker', () => {
    it('should activate circuit breaker after consecutive failures', async () => {
      const config: Partial<RetryConfig> = {
        enableCircuitBreaker: true,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldown: 5000,
        backoffDelays: [100],
      };

      // @ts-expect-error - Reset singleton
      RetryQueue.instance = undefined;
      retryQueue = RetryQueue.getInstance(config);

      const processor = jest.fn().mockResolvedValue(false); // Always fail
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      // Enqueue multiple items
      for (let i = 0; i < 5; i++) {
        await retryQueue.enqueue({
          operationType: 'READ_RECEIPT_BATCH',
          data: { messageIds: [`msg${i}`], userId: 'user1' },
        });
      }

      // Process queue - should stop after circuit breaker threshold
      await retryQueue.processQueue();
      jest.advanceTimersByTime(200);
      await retryQueue.processQueue();
      jest.advanceTimersByTime(200);
      await retryQueue.processQueue();

      // Circuit breaker should be active
      expect(retryQueue.isCircuitBreakerActive()).toBe(true);

      // Further processing should be blocked
      const beforeCount = processor.mock.calls.length;
      await retryQueue.processQueue();
      expect(processor.mock.calls.length).toBe(beforeCount); // No new calls

      // After cooldown, circuit breaker should reset
      jest.advanceTimersByTime(5000);
      await retryQueue.processQueue();
      expect(retryQueue.isCircuitBreakerActive()).toBe(false);
    });
  });

  describe('Queue Size Limits', () => {
    it('should enforce maximum queue size', async () => {
      const config: Partial<RetryConfig> = {
        maxQueueSize: 3,
      };

      // @ts-expect-error - Reset singleton
      RetryQueue.instance = undefined;
      retryQueue = RetryQueue.getInstance(config);

      // Enqueue items up to limit
      for (let i = 0; i < 3; i++) {
        await retryQueue.enqueue({
          operationType: 'READ_RECEIPT_BATCH',
          data: { messageIds: [`msg${i}`], userId: 'user1' },
        });
      }

      expect(retryQueue.getQueueSize()).toBe(3);

      // Should throw when exceeding limit
      await expect(
        retryQueue.enqueue({
          operationType: 'READ_RECEIPT_BATCH',
          data: { messageIds: ['overflow'], userId: 'user1' },
        })
      ).rejects.toThrow('Queue size limit (3) exceeded');
    });

    it('should handle overflow by removing items after processing', async () => {
      const config: Partial<RetryConfig> = {
        maxQueueSize: 2,
      };

      // @ts-expect-error - Reset singleton
      RetryQueue.instance = undefined;
      retryQueue = RetryQueue.getInstance(config);

      const processor = jest.fn().mockResolvedValue(true); // Success
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      // Fill queue
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg2'], userId: 'user1' },
      });

      // Process one item
      await retryQueue.processQueue();

      // Now should be able to add another
      await expect(
        retryQueue.enqueue({
          operationType: 'READ_RECEIPT_BATCH',
          data: { messageIds: ['msg3'], userId: 'user1' },
        })
      ).resolves.toBeDefined();

      expect(retryQueue.getQueueSize()).toBe(2); // msg2 and msg3
    });
  });

  describe('Error Handling', () => {
    it('should handle processor errors gracefully', async () => {
      const processor = jest.fn().mockRejectedValue(new Error('Processing failed'));
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });

      // Should not throw
      await expect(retryQueue.processQueue()).resolves.not.toThrow();

      // Item should still be in queue for retry
      expect(retryQueue.getQueueSize()).toBe(1);
      const items = retryQueue.getQueueItems();
      expect(items[0].lastError).toBe('Processing failed');
    });

    it('should handle missing processor gracefully', async () => {
      await retryQueue.enqueue({
        operationType: 'MESSAGE_SEND', // No processor registered for this
        data: { text: 'Hello' },
      });

      // Should not throw
      await expect(retryQueue.processQueue()).resolves.not.toThrow();

      // Item should remain in queue
      expect(retryQueue.getQueueSize()).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent enqueue operations', async () => {
      const processor = jest.fn().mockResolvedValue(true);
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      // Enqueue multiple items concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          retryQueue.enqueue({
            operationType: 'READ_RECEIPT_BATCH',
            data: { messageIds: [`msg${i}`], userId: 'user1' },
          })
        );
      }

      await Promise.all(promises);

      expect(retryQueue.getQueueSize()).toBe(10);
    });

    it('should prevent multiple simultaneous processQueue calls', async () => {
      const processor = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      retryQueue.registerProcessor('READ_RECEIPT_BATCH', processor);

      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg1'], userId: 'user1' },
      });

      // Call processQueue multiple times simultaneously
      const promise1 = retryQueue.processQueue();
      const promise2 = retryQueue.processQueue();
      const promise3 = retryQueue.processQueue();

      await Promise.all([promise1, promise2, promise3]);

      // Only one should actually process
      expect(processor).toHaveBeenCalledTimes(1);
    });
  });
});