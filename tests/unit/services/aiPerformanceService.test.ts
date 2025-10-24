/**
 * Unit tests for AI Performance Tracking Service
 */

import {
  trackOperationStart,
  trackOperationEnd,
  getOperationMetrics,
  calculateAggregatedPerformance,
  calculateAverageLatency,
} from '../../../services/aiPerformanceService';
import { getFirestore, collection, addDoc, query, getDocs, Timestamp, where, orderBy } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  getDocs: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: jest.fn((date) => ({ toMillis: () => date.getTime() })),
    fromMillis: jest.fn((ms) => ({ toMillis: () => ms })),
  },
}));

// Mock Firebase service
jest.mock('../../../services/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({})),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockAddDoc = addDoc as jest.MockedFunction<typeof addDoc>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>;

describe('aiPerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirestore.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
    mockOrderBy.mockReturnValue({} as any);
  });

  describe('trackOperationStart', () => {
    it('should track operation start time', () => {
      const opId = 'test_op_123';
      const result = trackOperationStart(opId, 'categorization');
      expect(result).toBe(opId);
    });

    it('should not throw on error', () => {
      expect(() => {
        trackOperationStart('test_op_456', 'categorization');
      }).not.toThrow();
    });
  });

  describe('trackOperationEnd', () => {
    beforeEach(() => {
      mockAddDoc.mockResolvedValue({ id: 'mock_doc_id' } as any);
    });

    it('should calculate latency and write metrics to Firestore', async () => {
      const opId = 'test_op_789';
      trackOperationStart(opId, 'categorization');

      // Wait a bit to ensure latency > 0
      await new Promise((resolve) => setTimeout(resolve, 10));

      await trackOperationEnd(opId, {
        userId: 'user123',
        operation: 'categorization',
        success: true,
        modelUsed: 'gpt-4o-mini',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        costCents: 2,
        cacheHit: false,
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user123',
          operation: 'categorization',
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        })
      );
    });

    it('should handle cache hit metrics', async () => {
      const opId = 'test_op_cache';
      trackOperationStart(opId, 'faq_detection');

      await trackOperationEnd(opId, {
        userId: 'user123',
        operation: 'faq_detection',
        success: true,
        modelUsed: 'gpt-4o-mini',
        tokensUsed: { prompt: 50, completion: 25, total: 75 },
        costCents: 1,
        cacheHit: true,
        cacheKey: 'faq_hash_abc123',
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          cacheHit: true,
          cacheKey: 'faq_hash_abc123',
        })
      );
    });

    it('should handle operation failures', async () => {
      const opId = 'test_op_error';
      trackOperationStart(opId, 'voice_matching');

      await trackOperationEnd(opId, {
        userId: 'user123',
        operation: 'voice_matching',
        success: false,
        errorType: 'rate_limit',
        modelUsed: 'gpt-4-turbo',
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        costCents: 0,
        cacheHit: false,
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          success: false,
          errorType: 'rate_limit',
        })
      );
    });

    it('should not throw on Firestore write error (circuit breaker)', async () => {
      mockAddDoc.mockRejectedValue(new Error('Firestore write failed'));

      const opId = 'test_op_firestore_error';
      trackOperationStart(opId, 'categorization');

      await expect(
        trackOperationEnd(opId, {
          userId: 'user123',
          operation: 'categorization',
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
        })
      ).resolves.not.toThrow();
    });

    it('should handle missing start time gracefully', async () => {
      const opId = 'test_op_no_start';

      await trackOperationEnd(opId, {
        userId: 'user123',
        operation: 'categorization',
        success: true,
        modelUsed: 'gpt-4o-mini',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        costCents: 2,
        cacheHit: false,
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          latency: 0, // Should default to 0 if no start time
        })
      );
    });
  });

  describe('getOperationMetrics', () => {
    it('should retrieve metrics from Firestore', async () => {
      const mockMetrics = [
        {
          id: 'metric1',
          userId: 'user123',
          operation: 'categorization',
          latency: 450,
          timestamp: { toMillis: () => Date.now() },
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() },
        },
        {
          id: 'metric2',
          userId: 'user123',
          operation: 'categorization',
          latency: 380,
          timestamp: { toMillis: () => Date.now() },
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 90, completion: 45, total: 135 },
          costCents: 1,
          cacheHit: true,
          cacheKey: 'cache_key_123',
          createdAt: { toMillis: () => Date.now() },
        },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => {
            callback({
              id: metric.id,
              data: () => metric,
            });
          });
        },
      } as any);

      const result = await getOperationMetrics('user123', 'categorization');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'metric1', userId: 'user123' });
      expect(result[1]).toMatchObject({ id: 'metric2', userId: 'user123' });
    });

    it('should handle Firestore errors', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore query failed'));

      await expect(getOperationMetrics('user123', 'categorization')).rejects.toThrow(
        'Unable to load performance metrics. Please try again.'
      );
    });

    it('should return empty array when no metrics found', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: () => {},
      } as any);

      const result = await getOperationMetrics('user123', 'categorization');
      expect(result).toEqual([]);
    });
  });

  describe('calculateAggregatedPerformance', () => {
    it('should calculate aggregated performance statistics', () => {
      const mockMetrics = [
        {
          id: '1',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 400,
          timestamp: { toMillis: () => new Date('2025-10-24T10:00:00Z').getTime() } as any,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() } as any,
        },
        {
          id: '2',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 500,
          timestamp: { toMillis: () => new Date('2025-10-24T10:01:00Z').getTime() } as any,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 110, completion: 55, total: 165 },
          costCents: 2,
          cacheHit: true,
          cacheKey: 'cache_123',
          createdAt: { toMillis: () => Date.now() } as any,
        },
        {
          id: '3',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 600,
          timestamp: { toMillis: () => new Date('2025-10-24T10:02:00Z').getTime() } as any,
          success: false,
          errorType: 'rate_limit' as const,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          costCents: 0,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() } as any,
        },
        {
          id: '4',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 300,
          timestamp: { toMillis: () => new Date('2025-10-24T10:03:00Z').getTime() } as any,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 95, completion: 48, total: 143 },
          costCents: 2,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() } as any,
        },
      ];

      const result = calculateAggregatedPerformance(mockMetrics);

      expect(result).not.toBeNull();
      expect(result!.operation).toBe('categorization');
      expect(result!.averageLatency).toBe(450); // (400 + 500 + 600 + 300) / 4
      expect(result!.successRate).toBe(0.75); // 3 successes out of 4
      expect(result!.cacheHitRate).toBe(0.25); // 1 cache hit out of 4
      expect(result!.totalOperations).toBe(4);
    });

    it('should return null for empty metrics array', () => {
      const result = calculateAggregatedPerformance([]);
      expect(result).toBeNull();
    });

    it('should calculate percentiles correctly', () => {
      const mockMetrics = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        userId: 'user123',
        operation: 'categorization' as const,
        latency: (i + 1) * 10, // 10, 20, 30, ..., 1000
        timestamp: { toMillis: () => Date.now() } as any,
        success: true,
        modelUsed: 'gpt-4o-mini',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        costCents: 2,
        cacheHit: false,
        createdAt: { toMillis: () => Date.now() } as any,
      }));

      const result = calculateAggregatedPerformance(mockMetrics);

      expect(result).not.toBeNull();
      expect(result!.p50Latency).toBe(510); // 50th percentile
      expect(result!.p95Latency).toBe(960); // 95th percentile
      expect(result!.p99Latency).toBe(1000); // 99th percentile
    });
  });

  describe('calculateAverageLatency', () => {
    it('should calculate average latency', () => {
      const mockMetrics = [
        {
          id: '1',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 400,
          timestamp: { toMillis: () => Date.now() } as any,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 2,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() } as any,
        },
        {
          id: '2',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 500,
          timestamp: { toMillis: () => Date.now() } as any,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 110, completion: 55, total: 165 },
          costCents: 2,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() } as any,
        },
        {
          id: '3',
          userId: 'user123',
          operation: 'categorization' as const,
          latency: 600,
          timestamp: { toMillis: () => Date.now() } as any,
          success: true,
          modelUsed: 'gpt-4o-mini',
          tokensUsed: { prompt: 105, completion: 53, total: 158 },
          costCents: 2,
          cacheHit: false,
          createdAt: { toMillis: () => Date.now() } as any,
        },
      ];

      const result = calculateAverageLatency(mockMetrics);
      expect(result).toBe(500); // (400 + 500 + 600) / 3
    });

    it('should return 0 for empty metrics array', () => {
      const result = calculateAverageLatency([]);
      expect(result).toBe(0);
    });
  });
});
