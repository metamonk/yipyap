/**
 * Unit tests for Idempotency helpers
 * Tests deduplication logic, LRU cache, TTL expiration, and hash generation
 */

import {
  IdempotencyCache,
  makeIdempotent,
  Idempotent,
} from '@/utils/idempotencyHelpers';

// Mock timers for testing TTL
jest.useFakeTimers();

describe('IdempotencyCache', () => {
  let cache: IdempotencyCache;

  beforeEach(() => {
    // Reset singleton for each test
    // @ts-expect-error - Access private for testing
    IdempotencyCache.instance = undefined;
    cache = IdempotencyCache.getInstance();
  });

  afterEach(() => {
    cache.destroy();
    jest.clearAllTimers();
  });

  describe('Duplicate Detection', () => {
    it('should detect identical operations', () => {
      const operationData = {
        type: 'READ_RECEIPT',
        messageIds: ['msg1', 'msg2'],
        userId: 'user123',
      };

      const id = cache.generateOperationId(operationData);

      // First call - not processed
      expect(cache.hasProcessed(id)).toBe(false);

      // Mark as processed
      cache.markProcessed(id);

      // Second call - already processed
      expect(cache.hasProcessed(id)).toBe(true);
    });

    it('should generate same ID for identical data regardless of key order', () => {
      const data1 = {
        userId: 'user123',
        messageIds: ['msg1', 'msg2'],
        type: 'READ_RECEIPT',
      };

      const data2 = {
        type: 'READ_RECEIPT',
        messageIds: ['msg1', 'msg2'],
        userId: 'user123',
      };

      const id1 = cache.generateOperationId(data1);
      const id2 = cache.generateOperationId(data2);

      expect(id1).toBe(id2);
    });

    it('should generate same ID for arrays with same elements regardless of order', () => {
      const data1 = {
        type: 'BATCH_UPDATE',
        ids: ['id3', 'id1', 'id2'],
      };

      const data2 = {
        type: 'BATCH_UPDATE',
        ids: ['id1', 'id2', 'id3'],
      };

      const id1 = cache.generateOperationId(data1);
      const id2 = cache.generateOperationId(data2);

      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different operations', () => {
      const data1 = {
        type: 'READ_RECEIPT',
        messageId: 'msg1',
      };

      const data2 = {
        type: 'READ_RECEIPT',
        messageId: 'msg2',
      };

      const id1 = cache.generateOperationId(data1);
      const id2 = cache.generateOperationId(data2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('Cache Size Limit (LRU Eviction)', () => {
    it('should enforce maximum cache size', () => {
      // Create cache with small size limit
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ maxSize: 3 });

      // Add items up to limit
      cache.markProcessed('op1');
      cache.markProcessed('op2');
      cache.markProcessed('op3');

      expect(cache.getSize()).toBe(3);

      // Adding another should evict the oldest (op1)
      cache.markProcessed('op4');

      expect(cache.getSize()).toBe(3);
      expect(cache.hasProcessed('op1')).toBe(false); // Evicted
      expect(cache.hasProcessed('op2')).toBe(true);
      expect(cache.hasProcessed('op3')).toBe(true);
      expect(cache.hasProcessed('op4')).toBe(true);
    });

    it('should update LRU order on access', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ maxSize: 3 });

      cache.markProcessed('op1');
      cache.markProcessed('op2');
      cache.markProcessed('op3');

      // Access op1, making it most recently used
      cache.hasProcessed('op1');

      // Add op4, should evict op2 (now least recently used)
      cache.markProcessed('op4');

      expect(cache.hasProcessed('op1')).toBe(true); // Still present
      expect(cache.hasProcessed('op2')).toBe(false); // Evicted
      expect(cache.hasProcessed('op3')).toBe(true);
      expect(cache.hasProcessed('op4')).toBe(true);
    });

    it('should handle repeated marking of same operation', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ maxSize: 3 });

      const isNew1 = cache.markProcessed('op1');
      expect(isNew1).toBe(true);

      const isNew2 = cache.markProcessed('op1');
      expect(isNew2).toBe(false); // Already existed

      expect(cache.getSize()).toBe(1); // Still only one entry
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ ttl: 5000 }); // 5 second TTL

      cache.markProcessed('op1');
      expect(cache.hasProcessed('op1')).toBe(true);

      // Advance time past TTL
      jest.advanceTimersByTime(6000);

      expect(cache.hasProcessed('op1')).toBe(false); // Expired
    });

    it('should not expire entries before TTL', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ ttl: 5000 });

      cache.markProcessed('op1');

      // Advance time but not past TTL
      jest.advanceTimersByTime(4000);

      expect(cache.hasProcessed('op1')).toBe(true); // Still valid
    });

    it('should cleanup expired entries periodically', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ ttl: 5000 });

      cache.markProcessed('op1');
      cache.markProcessed('op2');

      expect(cache.getSize()).toBe(2);

      // Advance time to trigger cleanup (cleanup runs every minute)
      jest.advanceTimersByTime(61000);

      expect(cache.getSize()).toBe(0); // Both entries cleaned up
    });
  });

  describe('Hash Generation', () => {
    it('should generate consistent hashes for same input', () => {
      const data = { key: 'value', number: 123 };

      const id1 = cache.generateOperationId(data);
      const id2 = cache.generateOperationId(data);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]+$/); // Hex format
    });

    it('should handle nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
      };

      const id = cache.generateOperationId(data);
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should handle null and undefined values', () => {
      const data1 = { key: null };
      const data2 = { key: undefined };

      const id1 = cache.generateOperationId(data1);
      const id2 = cache.generateOperationId(data2);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2); // null and undefined are different
    });

    it('should handle arrays with mixed types', () => {
      const data = {
        mixed: [1, 'string', null, { nested: true }, ['array']],
      };

      const id = cache.generateOperationId(data);
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent cache operations', async () => {
      const promises = [];

      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            const id = `op${i % 10}`; // Some overlap
            cache.markProcessed(id);
            return cache.hasProcessed(id);
          })
        );
      }

      const results = await Promise.all(promises);

      // All operations should complete without error
      expect(results.every(r => r === true)).toBe(true);
      expect(cache.getSize()).toBeLessThanOrEqual(10);
    });
  });

  describe('Result Storage', () => {
    it('should store and retrieve operation results when configured', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ storeResults: true });

      const result = { success: true, data: 'test' };
      cache.markProcessed('op1', result);

      const retrieved = cache.getResult('op1');
      expect(retrieved).toEqual(result);
    });

    it('should not store results when not configured', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ storeResults: false });

      const result = { success: true, data: 'test' };
      cache.markProcessed('op1', result);

      const retrieved = cache.getResult('op1');
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined for expired entries', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ storeResults: true, ttl: 1000 });

      cache.markProcessed('op1', { data: 'test' });

      jest.advanceTimersByTime(2000);

      const retrieved = cache.getResult('op1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should provide accurate cache statistics', () => {
      // @ts-expect-error - Reset singleton
      IdempotencyCache.instance = undefined;
      cache = IdempotencyCache.getInstance({ maxSize: 10, ttl: 5000 });

      cache.markProcessed('op1');
      jest.advanceTimersByTime(1000);
      cache.markProcessed('op2');
      jest.advanceTimersByTime(1000);
      cache.markProcessed('op3');

      const stats = cache.getStats();

      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(10);
      expect(stats.ttl).toBe(5000);
      expect(stats.oldestEntryAge).toBeCloseTo(2000, -2); // ~2 seconds old
    });

    it('should handle empty cache stats', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.oldestEntryAge).toBeNull();
    });
  });
});

describe('makeIdempotent Function', () => {
  let cache: IdempotencyCache;

  beforeEach(() => {
    // @ts-expect-error - Reset singleton
    IdempotencyCache.instance = undefined;
    cache = IdempotencyCache.getInstance({ storeResults: true });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should make async function idempotent', async () => {
    let callCount = 0;
    const originalFunction = async (id: string, value: number) => {
      callCount++;
      return { id, value, result: value * 2 };
    };

    const idempotentFunction = makeIdempotent(
      originalFunction,
      (id, value) => ({ id, value })
    );

    // First call
    const result1 = await idempotentFunction('test', 5);
    expect(result1).toEqual({ id: 'test', value: 5, result: 10 });
    expect(callCount).toBe(1);

    // Second call with same arguments - should return cached
    const result2 = await idempotentFunction('test', 5);
    expect(result2).toEqual({ id: 'test', value: 5, result: 10 });
    expect(callCount).toBe(1); // Not called again

    // Call with different arguments
    const result3 = await idempotentFunction('test2', 10);
    expect(result3).toEqual({ id: 'test2', value: 10, result: 20 });
    expect(callCount).toBe(2);
  });

  it('should not cache errors', async () => {
    let callCount = 0;
    const failingFunction = async () => {
      callCount++;
      throw new Error('Operation failed');
    };

    const idempotentFunction = makeIdempotent(
      failingFunction,
      () => ({ operation: 'test' })
    );

    // First call - should throw
    await expect(idempotentFunction()).rejects.toThrow('Operation failed');
    expect(callCount).toBe(1);

    // Second call - should try again (error not cached)
    await expect(idempotentFunction()).rejects.toThrow('Operation failed');
    expect(callCount).toBe(2);
  });

  it('should handle promise rejection', async () => {
    const rejectedFunction = async () => {
      return Promise.reject(new Error('Rejected'));
    };

    const idempotentFunction = makeIdempotent(
      rejectedFunction,
      () => ({ op: 'test' })
    );

    await expect(idempotentFunction()).rejects.toThrow('Rejected');

    // Should not be in cache
    const id = cache.generateOperationId({ op: 'test' });
    expect(cache.hasProcessed(id)).toBe(false);
  });
});

describe('Idempotent Decorator', () => {
  let cache: IdempotencyCache;

  beforeEach(() => {
    // @ts-expect-error - Reset singleton
    IdempotencyCache.instance = undefined;
    cache = IdempotencyCache.getInstance({ storeResults: true });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should make class method idempotent', async () => {
    class TestService {
      public callCount = 0;

      @Idempotent((id: string, value: number) => ({ id, value }))
      async processData(id: string, value: number) {
        this.callCount++;
        return value * 2;
      }
    }

    const service = new TestService();

    // First call
    const result1 = await service.processData('test', 5);
    expect(result1).toBe(10);
    expect(service.callCount).toBe(1);

    // Second call with same arguments
    const result2 = await service.processData('test', 5);
    expect(result2).toBe(10);
    expect(service.callCount).toBe(1); // Not incremented

    // Different arguments
    const result3 = await service.processData('test2', 7);
    expect(result3).toBe(14);
    expect(service.callCount).toBe(2);
  });

  it('should maintain correct this binding', async () => {
    class TestService {
      private multiplier = 3;

      @Idempotent((value: number) => ({ value }))
      async multiply(value: number) {
        return value * this.multiplier;
      }
    }

    const service = new TestService();

    const result = await service.multiply(4);
    expect(result).toBe(12); // 4 * 3
  });

  it('should work with multiple decorated methods', async () => {
    class TestService {
      public methodACalls = 0;
      public methodBCalls = 0;

      @Idempotent((id: string) => ({ method: 'A', id }))
      async methodA(id: string) {
        this.methodACalls++;
        return `A-${id}`;
      }

      @Idempotent((id: string) => ({ method: 'B', id }))
      async methodB(id: string) {
        this.methodBCalls++;
        return `B-${id}`;
      }
    }

    const service = new TestService();

    // Call each method twice
    await service.methodA('test');
    await service.methodA('test');
    await service.methodB('test');
    await service.methodB('test');

    expect(service.methodACalls).toBe(1);
    expect(service.methodBCalls).toBe(1);
  });
});

describe('Edge Cases', () => {
  let cache: IdempotencyCache;

  beforeEach(() => {
    // @ts-expect-error - Reset singleton
    IdempotencyCache.instance = undefined;
    cache = IdempotencyCache.getInstance();
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should handle circular references in data', () => {
     
    const data: any = { key: 'value' };
    data.circular = data; // Create circular reference

    // Should not throw or cause infinite loop
    expect(() => cache.generateOperationId(data)).not.toThrow();
  });

  it('should clear all entries', () => {
    cache.markProcessed('op1');
    cache.markProcessed('op2');
    cache.markProcessed('op3');

    expect(cache.getSize()).toBe(3);

    cache.clear();

    expect(cache.getSize()).toBe(0);
    expect(cache.hasProcessed('op1')).toBe(false);
    expect(cache.hasProcessed('op2')).toBe(false);
    expect(cache.hasProcessed('op3')).toBe(false);
  });

  it('should stop cleanup timer on destroy', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    cache.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(cache.getSize()).toBe(0);
  });
});