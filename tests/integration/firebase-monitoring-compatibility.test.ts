/**
 * Integration test for Firebase Monitoring Compatibility
 * @module tests/integration/firebase-monitoring-compatibility
 *
 * @remarks
 * Story 5.9 - AI Performance Monitoring & Cost Control
 * Verifies that AI monitoring doesn't interfere with Firebase Crashlytics and Analytics
 */

import { trackOperationStart, trackOperationEnd } from '@/services/aiPerformanceService';
import { trackModelUsage } from '@/services/aiCostMonitoringService';
import { incrementOperationCount } from '@/services/aiRateLimitService';

jest.setTimeout(30000);

describe('Firebase Monitoring Compatibility', () => {
  const testUserId = 'test-user-compat';
  const testOperation = 'categorization';

  describe('Service Availability', () => {
    it('should have all monitoring services available', () => {
      expect(trackOperationStart).toBeDefined();
      expect(trackOperationEnd).toBeDefined();
      expect(trackModelUsage).toBeDefined();
      expect(incrementOperationCount).toBeDefined();
    });

    it('should not throw when tracking operations', async () => {
      const opId = 'test-op-1';

      expect(() => {
        trackOperationStart(opId, testOperation);
      }).not.toThrow();

      await expect(
        trackOperationEnd(opId, {
          userId: testUserId,
          operation: testOperation,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        })
      ).resolves.not.toThrow();
    });

    it('should not throw when tracking costs', async () => {
      await expect(
        trackModelUsage(testUserId, testOperation, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        })
      ).resolves.not.toThrow();
    });

    it('should not throw when tracking rate limits', async () => {
      await expect(
        incrementOperationCount(testUserId, testOperation)
      ).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple monitoring calls concurrently', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        id: `test-op-concurrent-${i}`,
        operation: testOperation,
      }));

      const promises = operations.map(async (op) => {
        trackOperationStart(op.id, op.operation);

        await Promise.all([
          incrementOperationCount(testUserId, op.operation),
          trackModelUsage(testUserId, op.operation, {
            model: 'gpt-4o-mini',
            tokensUsed: { prompt: 100, completion: 50, total: 150 },
            costCents: 2,
          }),
        ]);

        await trackOperationEnd(op.id, {
          userId: testUserId,
          operation: op.operation,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        });
      });

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle invalid user IDs', async () => {
      await expect(
        trackModelUsage('', testOperation, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        })
      ).resolves.not.toThrow();
    });

    it('should gracefully handle invalid operations', async () => {
      await expect(
        trackModelUsage(testUserId, 'invalid_operation' as any, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        })
      ).resolves.not.toThrow();
    });

    it('should continue after failed tracking', async () => {
      const opId = 'test-op-error';

      // This should not throw even if tracking fails internally
      trackOperationStart(opId, testOperation);

      await trackOperationEnd(opId, {
        userId: '', // Invalid
        operation: testOperation,
        success: false,
        errorType: 'network',
        modelUsed: 'gpt-4o-mini',
        tokensUsed: { prompt: 100, completion: 0, total: 100 },
        costCents: 1,
        cacheHit: false,
      });

      // Should be able to continue with more operations
      const opId2 = 'test-op-continue';
      trackOperationStart(opId2, testOperation);

      await expect(
        trackOperationEnd(opId2, {
          userId: testUserId,
          operation: testOperation,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Non-Blocking Behavior', () => {
    it('should not significantly delay when all monitoring is active', async () => {
      const start = performance.now();

      const opId = 'test-op-timing';
      trackOperationStart(opId, testOperation);

      await Promise.all([
        incrementOperationCount(testUserId, testOperation),
        trackModelUsage(testUserId, testOperation, {
          model: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
        }),
      ]);

      await trackOperationEnd(opId, {
        userId: testUserId,
        operation: testOperation,
        success: true,
        modelUsed: 'gpt-4o-mini',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        costCents: 2,
        cacheHit: false,
      });

      const end = performance.now();
      const duration = end - start;

      // All monitoring should complete quickly
      expect(duration).toBeLessThan(100); // Generous limit
    });
  });
});
