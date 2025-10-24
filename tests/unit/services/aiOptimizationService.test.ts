/**
 * Unit tests for AI Optimization Service
 * @module tests/unit/services/aiOptimizationService
 */

import {
  analyzeOperationMetrics,
  generateRecommendations,
  getRecommendations,
  dismissRecommendation,
} from '@/services/aiOptimizationService';
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseApp: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: jest.fn((date: Date) => ({ toMillis: () => date.getTime() })),
  },
  limit: jest.fn(),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockAddDoc = addDoc as jest.MockedFunction<typeof addDoc>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;

describe('aiOptimizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirestore.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
    mockOrderBy.mockReturnValue({} as any);
    mockDoc.mockReturnValue({} as any);
  });

  describe('analyzeOperationMetrics', () => {
    it('should return empty array when insufficient data', async () => {
      // Mock query with only 5 operations (below MIN_OPERATIONS_FOR_ANALYSIS = 10)
      mockGetDocs.mockResolvedValue({
        size: 5,
        forEach: jest.fn(),
      } as any);

      const result = await analyzeOperationMetrics('user123', 'categorization', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      expect(result).toEqual([]);
    });

    it('should generate high latency recommendation when avg latency > 500ms', async () => {
      // Mock 20 operations with high latency (600ms average)
      const mockMetrics = Array.from({ length: 20 }, () => ({
        operation: 'categorization',
        latency: 600,
        costCents: 5,
        success: true,
        cacheHit: false,
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'categorization', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      expect(result.length).toBeGreaterThan(0);
      const latencyRec = result.find((r) => r.type === 'latency');
      expect(latencyRec).toBeDefined();
      expect(latencyRec?.title).toContain('High latency');
      expect(latencyRec?.description).toContain('600ms');
      expect(latencyRec?.severity).toBe('medium');
      expect(latencyRec?.actionable).toBe(true);
      expect(latencyRec?.actionSteps).toBeDefined();
      expect(latencyRec?.actionSteps!.length).toBeGreaterThan(0);
    });

    it('should generate high severity for very high latency (>1000ms)', async () => {
      // Mock 20 operations with very high latency (1200ms)
      const mockMetrics = Array.from({ length: 20 }, () => ({
        operation: 'categorization',
        latency: 1200,
        costCents: 5,
        success: true,
        cacheHit: false,
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'categorization', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const latencyRec = result.find((r) => r.type === 'latency');
      expect(latencyRec?.severity).toBe('high');
    });

    it('should generate high cost recommendation when avg cost > 10 cents', async () => {
      // Mock 20 operations with high cost (15 cents each)
      const mockMetrics = Array.from({ length: 20 }, () => ({
        operation: 'voice_matching',
        latency: 400,
        costCents: 15,
        success: true,
        cacheHit: false,
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'voice_matching', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const costRec = result.find((r) => r.type === 'cost');
      expect(costRec).toBeDefined();
      expect(costRec?.title).toContain('High costs');
      expect(costRec?.description).toContain('15.00¢');
      expect(costRec?.severity).toBe('medium');
      expect(costRec?.impact).toContain('save');
      expect(costRec?.actionSteps).toBeDefined();
    });

    it('should generate high severity for very high cost (>20 cents)', async () => {
      // Mock 20 operations with very high cost (25 cents each)
      const mockMetrics = Array.from({ length: 20 }, () => ({
        operation: 'voice_matching',
        latency: 400,
        costCents: 25,
        success: true,
        cacheHit: false,
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'voice_matching', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const costRec = result.find((r) => r.type === 'cost');
      expect(costRec?.severity).toBe('high');
    });

    it('should generate low cache hit rate recommendation when < 20%', async () => {
      // Mock 20 operations: 3 cache hits (15% hit rate)
      const mockMetrics = Array.from({ length: 20 }, (_, i) => ({
        operation: 'faq_detection',
        latency: 400,
        costCents: 5,
        success: true,
        cacheHit: i < 3, // First 3 are cache hits = 15%
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'faq_detection', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const cacheRec = result.find((r) => r.type === 'cache');
      expect(cacheRec).toBeDefined();
      expect(cacheRec?.title).toContain('Low cache hit rate');
      expect(cacheRec?.description).toContain('15.0%');
      expect(cacheRec?.severity).toBe('medium');
      expect(cacheRec?.impact).toContain('save');
      expect(cacheRec?.actionSteps).toBeDefined();
    });

    it('should generate high severity for very low cache hit rate (<10%)', async () => {
      // Mock 20 operations: 1 cache hit (5% hit rate)
      const mockMetrics = Array.from({ length: 20 }, (_, i) => ({
        operation: 'faq_detection',
        latency: 400,
        costCents: 5,
        success: true,
        cacheHit: i < 1, // Only first one is cache hit = 5%
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'faq_detection', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const cacheRec = result.find((r) => r.type === 'cache');
      expect(cacheRec?.severity).toBe('high');
    });

    it('should generate low success rate recommendation when < 95%', async () => {
      // Mock 20 operations: 18 successes (90% success rate)
      const mockMetrics = Array.from({ length: 20 }, (_, i) => ({
        operation: 'sentiment',
        latency: 400,
        costCents: 5,
        success: i < 18, // First 18 succeed = 90%
        cacheHit: false,
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'sentiment', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const errorRec = result.find((r) => r.title.includes('error rate'));
      expect(errorRec).toBeDefined();
      expect(errorRec?.description).toContain('90.0%');
      expect(errorRec?.severity).toBe('medium');
      expect(errorRec?.actionSteps).toBeDefined();
    });

    it('should generate high severity for very low success rate (<90%)', async () => {
      // Mock 20 operations: 17 successes (85% success rate)
      const mockMetrics = Array.from({ length: 20 }, (_, i) => ({
        operation: 'sentiment',
        latency: 400,
        costCents: 5,
        success: i < 17, // First 17 succeed = 85%
        cacheHit: false,
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'sentiment', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const errorRec = result.find((r) => r.title.includes('error rate'));
      expect(errorRec?.severity).toBe('high');
    });

    it('should generate multiple recommendations when multiple issues exist', async () => {
      // Mock 20 operations with high latency, high cost, and low cache hit rate
      const mockMetrics = Array.from({ length: 20 }, (_, i) => ({
        operation: 'voice_matching',
        latency: 700, // High latency
        costCents: 15, // High cost
        success: true,
        cacheHit: i < 2, // Low cache hit rate (10%)
      }));

      mockGetDocs.mockResolvedValue({
        size: 20,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'voice_matching', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      expect(result.length).toBe(3); // latency, cost, cache
      expect(result.some((r) => r.type === 'latency')).toBe(true);
      expect(result.some((r) => r.type === 'cost')).toBe(true);
      expect(result.some((r) => r.type === 'cache')).toBe(true);
    });

    it('should return empty array on Firestore error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await analyzeOperationMetrics('user123', 'categorization', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      expect(result).toEqual([]);
    });

    it('should not generate cache recommendation if operations < 20', async () => {
      // Mock 15 operations with low cache hit rate
      const mockMetrics = Array.from({ length: 15 }, (_, i) => ({
        operation: 'categorization',
        latency: 400,
        costCents: 5,
        success: true,
        cacheHit: i < 1, // Very low cache hit rate
      }));

      mockGetDocs.mockResolvedValue({
        size: 15,
        forEach: (callback: any) => {
          mockMetrics.forEach((metric) => callback({ data: () => metric }));
        },
      } as any);

      const result = await analyzeOperationMetrics('user123', 'categorization', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      });

      const cacheRec = result.find((r) => r.type === 'cache');
      expect(cacheRec).toBeUndefined(); // Should not generate cache rec with < 20 ops
    });
  });

  describe('generateRecommendations', () => {
    beforeEach(() => {
      mockAddDoc.mockResolvedValue({ id: 'rec_123' } as any);
    });

    it('should analyze all operation types', async () => {
      // Mock sufficient data for each operation
      const mockMetrics = Array.from({ length: 20 }, () => ({
        latency: 400,
        costCents: 5,
        success: true,
        cacheHit: true,
      }));

      mockGetDocs
        .mockResolvedValueOnce({
          size: 20,
          forEach: (callback: any) => mockMetrics.forEach((m) => callback({ data: () => m })),
        } as any)
        .mockResolvedValueOnce({
          size: 20,
          forEach: (callback: any) => mockMetrics.forEach((m) => callback({ data: () => m })),
        } as any)
        .mockResolvedValueOnce({
          size: 20,
          forEach: (callback: any) => mockMetrics.forEach((m) => callback({ data: () => m })),
        } as any)
        .mockResolvedValueOnce({
          size: 20,
          forEach: (callback: any) => mockMetrics.forEach((m) => callback({ data: () => m })),
        } as any)
        .mockResolvedValueOnce({
          size: 20,
          forEach: (callback: any) => mockMetrics.forEach((m) => callback({ data: () => m })),
        } as any)
        .mockResolvedValueOnce({
          size: 20,
          forEach: (callback: any) => mockMetrics.forEach((m) => callback({ data: () => m })),
        } as any)
        .mockResolvedValueOnce({
          // Mock existing recommendations query
          size: 0,
          forEach: jest.fn(),
        } as any);

      await generateRecommendations('user123');

      // Should query for 6 operations + 1 query for existing recommendations
      expect(mockGetDocs).toHaveBeenCalledTimes(7);
    });

    it('should write new recommendations to Firestore', async () => {
      // Mock high latency metrics
      const mockMetrics = Array.from({ length: 20 }, () => ({
        latency: 700,
        costCents: 5,
        success: true,
        cacheHit: true,
      }));

      // Mock 6 operation queries + 1 existing recommendations query
      for (let i = 0; i < 7; i++) {
        mockGetDocs.mockResolvedValueOnce({
          size: i < 6 ? 20 : 0, // Last one is existing recs (0)
          forEach: (callback: any) => {
            if (i < 6) {
              mockMetrics.forEach((m) => callback({ data: () => m }));
            }
          },
        } as any);
      }

      const result = await generateRecommendations('user123');

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should deduplicate existing recommendations', async () => {
      const mockMetrics = Array.from({ length: 20 }, () => ({
        latency: 700,
        costCents: 5,
        success: true,
        cacheHit: true,
      }));

      // Mock existing recommendation with same type and title for categorization
      const existingRec = {
        type: 'latency',
        title: 'High latency detected for Message Categorization',
        userId: 'user123',
        severity: 'medium',
        description: 'Test',
        impact: 'Test',
        actionable: true,
        dismissedAt: null,
        createdAt: Timestamp.now(),
      };

      // First 6 queries for operations, last query for existing recommendations
      for (let i = 0; i < 7; i++) {
        mockGetDocs.mockResolvedValueOnce({
          size: i < 6 ? 20 : 1,
          forEach: (callback: any) => {
            if (i < 6) {
              mockMetrics.forEach((m) => callback({ data: () => m }));
            } else {
              callback({ data: () => existingRec });
            }
          },
        } as any);
      }

      const result = await generateRecommendations('user123');

      // Should deduplicate categorization rec (matches existing), but generate 5 new recs for other operations
      // (sentiment, faq_detection, voice_matching, opportunity_scoring, daily_agent)
      expect(result.length).toBe(5);
      // Verify categorization is not in results
      expect(result.every((r) => !r.title.includes('Categorization'))).toBe(true);
    });

    it('should use default time window if not provided', async () => {
      mockGetDocs.mockResolvedValue({
        size: 5,
        forEach: jest.fn(),
      } as any);

      await generateRecommendations('user123');

      expect(mockGetDocs).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await generateRecommendations('user123');

      expect(result).toEqual([]);
    });
  });

  describe('getRecommendations', () => {
    it('should fetch and return active recommendations', async () => {
      const mockRecs = [
        {
          id: 'rec1',
          type: 'latency',
          severity: 'high',
          title: 'High latency',
          description: 'Test',
          impact: 'Test',
          actionable: true,
          userId: 'user123',
          createdAt: { toMillis: () => Date.now() },
        },
        {
          id: 'rec2',
          type: 'cost',
          severity: 'medium',
          title: 'High cost',
          description: 'Test',
          impact: 'Test',
          actionable: true,
          userId: 'user123',
          createdAt: { toMillis: () => Date.now() - 1000 },
        },
      ];

      mockGetDocs.mockResolvedValue({
        size: 2,
        forEach: (callback: any) => {
          mockRecs.forEach((rec) => callback({ id: rec.id, data: () => rec }));
        },
      } as any);

      const result = await getRecommendations('user123');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('rec1');
    });

    it('should sort by severity (high first) then by creation date', async () => {
      const now = Date.now();
      const mockRecs = [
        {
          id: 'rec1',
          type: 'latency',
          severity: 'low',
          title: 'Low severity',
          description: 'Test',
          impact: 'Test',
          actionable: true,
          userId: 'user123',
          createdAt: { toMillis: () => now },
        },
        {
          id: 'rec2',
          type: 'cost',
          severity: 'high',
          title: 'High severity',
          description: 'Test',
          impact: 'Test',
          actionable: true,
          userId: 'user123',
          createdAt: { toMillis: () => now - 1000 },
        },
        {
          id: 'rec3',
          type: 'cache',
          severity: 'medium',
          title: 'Medium severity',
          description: 'Test',
          impact: 'Test',
          actionable: true,
          userId: 'user123',
          createdAt: { toMillis: () => now - 2000 },
        },
      ];

      mockGetDocs.mockResolvedValue({
        size: 3,
        forEach: (callback: any) => {
          mockRecs.forEach((rec) => callback({ id: rec.id, data: () => rec }));
        },
      } as any);

      const result = await getRecommendations('user123');

      expect(result.length).toBe(3);
      expect(result[0].severity).toBe('high');
      expect(result[1].severity).toBe('medium');
      expect(result[2].severity).toBe('low');
    });

    it('should respect limit parameter', async () => {
      mockGetDocs.mockResolvedValue({
        size: 0,
        forEach: jest.fn(),
      } as any);

      await getRecommendations('user123', 5);

      expect(mockGetDocs).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await getRecommendations('user123');

      expect(result).toEqual([]);
    });
  });

  describe('dismissRecommendation', () => {
    it('should update dismissedAt timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await dismissRecommendation('user123', 'rec_123');

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        dismissedAt: expect.anything(),
      });
    });

    it('should not throw on error', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(dismissRecommendation('user123', 'rec_123')).resolves.not.toThrow();
    });
  });
});
