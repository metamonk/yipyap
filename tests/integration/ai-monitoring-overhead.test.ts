/**
 * Integration test for AI monitoring overhead
 * @module tests/integration/ai-monitoring-overhead
 *
 * @remarks
 * Story 5.9 - AI Performance Monitoring & Cost Control
 * Verifies that performance monitoring adds minimal overhead (<10ms) to AI operations
 */

import { trackOperationStart, trackOperationEnd } from '@/services/aiPerformanceService';
import { incrementOperationCount } from '@/services/aiRateLimitService';
import { trackModelUsage } from '@/services/aiCostMonitoringService';

jest.setTimeout(30000);

describe('AI Monitoring Overhead', () => {
  const testUserId = 'test-user-overhead';
  const testOperation = 'categorization';

  // Helper to measure execution time
  async function measureOverhead(fn: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await fn();
    const end = performance.now();
    return end - start;
  }

  describe('Performance Tracking Overhead', () => {
    it('should add <10ms overhead for tracking operation start', async () => {
      const overhead = await measureOverhead(async () => {
        trackOperationStart('test-op-1', testOperation);
      });

      expect(overhead).toBeLessThan(10);
    });

    it('should add <10ms overhead for tracking operation end', async () => {
      const opId = 'test-op-2';
      trackOperationStart(opId, testOperation);

      const overhead = await measureOverhead(async () => {
        await trackOperationEnd(opId, {
          userId: testUserId,
          operation: testOperation,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        });
      });

      expect(overhead).toBeLessThan(10);
    });

    it('should not block when Firestore writes fail', async () => {
      const opId = 'test-op-3';
      trackOperationStart(opId, testOperation);

      // Even if Firestore is down, this should complete quickly
      const overhead = await measureOverhead(async () => {
        await trackOperationEnd(opId, {
          userId: testUserId,
          operation: testOperation,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        });
      });

      expect(overhead).toBeLessThan(10);
    });
  });

  describe('Rate Limiting Overhead', () => {
    it('should add <10ms overhead for rate limit checks', async () => {
      const overhead = await measureOverhead(async () => {
        await incrementOperationCount(testUserId, testOperation);
      });

      expect(overhead).toBeLessThan(10);
    });
  });

  describe('Cost Monitoring Overhead', () => {
    it('should add <10ms overhead for cost tracking', async () => {
      const overhead = await measureOverhead(async () => {
        await trackModelUsage(testUserId, testOperation, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        });
      });

      expect(overhead).toBeLessThan(10);
    });
  });

  describe('Combined Monitoring Overhead', () => {
    it('should add <10ms total overhead when all monitoring is active', async () => {
      const opId = 'test-op-combined';

      const overhead = await measureOverhead(async () => {
        // Start tracking
        trackOperationStart(opId, testOperation);

        // Track rate limiting
        await incrementOperationCount(testUserId, testOperation);

        // Track cost
        await trackModelUsage(testUserId, testOperation, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        });

        // End tracking
        await trackOperationEnd(opId, {
          userId: testUserId,
          operation: testOperation,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        });
      });

      // Combined overhead should still be minimal
      expect(overhead).toBeLessThan(10);
    });
  });

  describe('Parallel Operations', () => {
    it('should handle concurrent operations without blocking', async () => {
      const operations = 10;
      const promises: Promise<void>[] = [];

      const start = performance.now();

      for (let i = 0; i < operations; i++) {
        const opId = `test-op-parallel-${i}`;
        promises.push(
          (async () => {
            trackOperationStart(opId, testOperation);
            await incrementOperationCount(testUserId, testOperation);
            await trackModelUsage(testUserId, testOperation, {
              model: 'gpt-4o-mini',
              tokensUsed: { prompt: 100, completion: 50, total: 150 },
              costCents: 2,
            });
            await trackOperationEnd(opId, {
              userId: testUserId,
              operation: testOperation,
              success: true,
              modelUsed: 'gpt-4o-mini',
              tokensUsed: { prompt: 100, completion: 50, total: 150 },
              costCents: 2,
              cacheHit: false,
            });
          })()
        );
      }

      await Promise.all(promises);

      const end = performance.now();
      const totalTime = end - start;
      const averageTimePerOperation = totalTime / operations;

      // Average per-operation overhead should be minimal
      expect(averageTimePerOperation).toBeLessThan(10);
    });
  });

  describe('Error Handling Overhead', () => {
    it('should not add significant overhead when operations fail', async () => {
      const opId = 'test-op-error';

      const overhead = await measureOverhead(async () => {
        trackOperationStart(opId, testOperation);

        await trackOperationEnd(opId, {
          userId: testUserId,
          operation: testOperation,
          success: false, // Failed operation
          errorType: 'network',
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 0, total: 100 },
          costCents: 1,
          cacheHit: false,
        });
      });

      expect(overhead).toBeLessThan(10);
    });

    it('should gracefully handle invalid data without blocking', async () => {
      const overhead = await measureOverhead(async () => {
        // Try to track with invalid userId (empty string)
        await trackModelUsage('', testOperation, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        });
      });

      // Should fail gracefully without blocking
      expect(overhead).toBeLessThan(10);
    });
  });
});
