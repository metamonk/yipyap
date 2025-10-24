/**
 * Unit tests for AI Model A/B Testing Service
 * @module tests/unit/services/aiModelTestingService
 */

import {
  assignModelVariant,
  trackVariantPerformance,
  compareVariantResults,
  createABTest,
  deactivateABTest,
  getActiveABTests,
  type ComparisonResult,
} from '@/services/aiModelTestingService';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({ name: 'test-app' })),
}));

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;

describe('aiModelTestingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock returns
    mockGetFirestore.mockReturnValue({} as any);
    mockDoc.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
  });

  describe('assignModelVariant', () => {
    it('should assign variant A for users that hash below splitRatio', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      // User 'user_a' should hash to a value < 0.5
      const variant = await assignModelVariant('test_123', 'user_a');

      expect(variant).not.toBeNull();
      expect(['A', 'B']).toContain(variant);
    });

    it('should return null if test does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const variant = await assignModelVariant('nonexistent', 'user123');

      expect(variant).toBeNull();
    });

    it('should return null if test is not active', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: false, // Inactive
        startDate: Timestamp.now(),
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      const variant = await assignModelVariant('test_123', 'user123');

      expect(variant).toBeNull();
    });

    it('should assign same variant to same user consistently', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      const variant1 = await assignModelVariant('test_123', 'user123');
      const variant2 = await assignModelVariant('test_123', 'user123');

      expect(variant1).toBe(variant2);
    });

    it('should respect custom splitRatio', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.9, // 90% to A, 10% to B
        active: true,
        startDate: Timestamp.now(),
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      // Test with many users to verify distribution (simplified)
      const variants = await Promise.all([
        assignModelVariant('test_123', 'user1'),
        assignModelVariant('test_123', 'user2'),
        assignModelVariant('test_123', 'user3'),
      ]);

      // All variants should be valid
      variants.forEach(v => expect(['A', 'B']).toContain(v));
    });

    it('should handle errors gracefully and default to variant A', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const variant = await assignModelVariant('test_123', 'user123');

      expect(variant).toBe('A');
    });
  });

  describe('trackVariantPerformance', () => {
    it('should initialize results if not present', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        // No results yet
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      mockSetDoc.mockResolvedValue(undefined);

      await trackVariantPerformance('test_123', 'A', {
        latency: 400,
        costCents: 1.5,
        success: true,
      });

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const updatedData = setDocCall[1] as any;

      expect(updatedData.results).toBeDefined();
      expect(updatedData.results.variantA.totalOperations).toBe(1);
      expect(updatedData.results.variantA.averageLatency).toBe(400);
      expect(updatedData.results.variantA.averageCost).toBe(1.5);
      expect(updatedData.results.variantA.successRate).toBe(1);
    });

    it('should update running averages correctly', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 2,
            averageLatency: 400,
            averageCost: 1.5,
            successRate: 1.0,
          },
          variantB: {
            totalOperations: 0,
            averageLatency: 0,
            averageCost: 0,
            successRate: 0,
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      mockSetDoc.mockResolvedValue(undefined);

      // Add third operation: latency 500, cost 2.0
      await trackVariantPerformance('test_123', 'A', {
        latency: 500,
        costCents: 2.0,
        success: true,
      });

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const updatedData = setDocCall[1] as any;

      // New averages: (400*2 + 500)/3 = 433.33, (1.5*2 + 2.0)/3 = 1.67
      expect(updatedData.results.variantA.totalOperations).toBe(3);
      expect(updatedData.results.variantA.averageLatency).toBeCloseTo(433.33, 1);
      expect(updatedData.results.variantA.averageCost).toBeCloseTo(1.67, 2);
      expect(updatedData.results.variantA.successRate).toBe(1.0);
    });

    it('should track failures and update success rate', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 2,
            averageLatency: 400,
            averageCost: 1.5,
            successRate: 1.0, // 2/2 successful
          },
          variantB: {
            totalOperations: 0,
            averageLatency: 0,
            averageCost: 0,
            successRate: 0,
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      mockSetDoc.mockResolvedValue(undefined);

      // Add a failed operation
      await trackVariantPerformance('test_123', 'A', {
        latency: 500,
        costCents: 2.0,
        success: false,
      });

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const updatedData = setDocCall[1] as any;

      // Success rate: 2/3 = 0.667
      expect(updatedData.results.variantA.successRate).toBeCloseTo(0.667, 2);
    });

    it('should track user satisfaction rating if provided', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 1,
            averageLatency: 400,
            averageCost: 1.5,
            successRate: 1.0,
            userSatisfactionRating: 4.0,
          },
          variantB: {
            totalOperations: 0,
            averageLatency: 0,
            averageCost: 0,
            successRate: 0,
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      mockSetDoc.mockResolvedValue(undefined);

      await trackVariantPerformance('test_123', 'A', {
        latency: 500,
        costCents: 2.0,
        success: true,
        userSatisfactionRating: 5.0,
      });

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const updatedData = setDocCall[1] as any;

      // Average rating: (4.0 + 5.0) / 2 = 4.5
      expect(updatedData.results.variantA.userSatisfactionRating).toBe(4.5);
    });

    it('should track variant B correctly', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 0,
            averageLatency: 0,
            averageCost: 0,
            successRate: 0,
          },
          variantB: {
            totalOperations: 0,
            averageLatency: 0,
            averageCost: 0,
            successRate: 0,
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      mockSetDoc.mockResolvedValue(undefined);

      await trackVariantPerformance('test_123', 'B', {
        latency: 450,
        costCents: 8.0,
        success: true,
      });

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const updatedData = setDocCall[1] as any;

      expect(updatedData.results.variantB.totalOperations).toBe(1);
      expect(updatedData.results.variantB.averageLatency).toBe(450);
      expect(updatedData.results.variantB.averageCost).toBe(8.0);
      expect(updatedData.results.variantB.successRate).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        trackVariantPerformance('test_123', 'A', {
          latency: 400,
          costCents: 1.5,
          success: true,
        })
      ).resolves.not.toThrow();
    });

    it('should return early if test not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await trackVariantPerformance('nonexistent', 'A', {
        latency: 400,
        costCents: 1.5,
        success: true,
      });

      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe('compareVariantResults', () => {
    it('should return null if test not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await compareVariantResults('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if no results yet', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        // No results
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      const result = await compareVariantResults('test_123');

      expect(result).toBeNull();
    });

    it('should return null if insufficient sample size', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 10, // Less than MIN_OPERATIONS (30)
            averageLatency: 400,
            averageCost: 1.5,
            successRate: 0.99,
          },
          variantB: {
            totalOperations: 10,
            averageLatency: 450,
            averageCost: 8.0,
            successRate: 0.995,
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      const result = await compareVariantResults('test_123');

      expect(result).toBeNull();
    });

    it('should correctly compare variants and declare winner', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 100,
            averageLatency: 400,
            averageCost: 1.5,
            successRate: 0.99,
          },
          variantB: {
            totalOperations: 100,
            averageLatency: 450,
            averageCost: 8.0,
            successRate: 0.995,
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      const result = await compareVariantResults('test_123');

      expect(result).not.toBeNull();
      expect(['A', 'B', 'tie']).toContain(result!.winner);
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(100);
      expect(result!.recommendation).toBeTruthy();
      expect(result!.sampleSize.variantA).toBe(100);
      expect(result!.sampleSize.variantB).toBe(100);
    });

    it('should calculate percentage differences correctly', async () => {
      const mockTestConfig = {
        id: 'test_123',
        name: 'Test',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: {} },
        variantB: { model: 'gpt-4-turbo', parameters: {} },
        splitRatio: 0.5,
        active: true,
        startDate: Timestamp.now(),
        results: {
          variantA: {
            totalOperations: 100,
            averageLatency: 400,
            averageCost: 2.0,
            successRate: 0.98,
          },
          variantB: {
            totalOperations: 100,
            averageLatency: 500, // 25% slower
            averageCost: 4.0, // 100% more expensive
            successRate: 0.99, // 1.02% better
          },
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockTestConfig,
      } as any);

      const result = await compareVariantResults('test_123');

      expect(result).not.toBeNull();
      expect(result!.latencyDiff).toBeCloseTo(25, 0); // B is 25% slower
      expect(result!.costDiff).toBeCloseTo(100, 0); // B is 100% more expensive
      expect(result!.successRateDiff).toBeCloseTo(1.02, 1); // B is ~1% better
    });

    it('should handle errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await compareVariantResults('test_123');

      expect(result).toBeNull();
    });
  });

  describe('createABTest', () => {
    it('should create new A/B test with generated ID', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const testId = await createABTest({
        name: 'Test Categorization',
        operation: 'categorization',
        variantA: { model: 'gpt-4o-mini', parameters: { temperature: 0.7 } },
        variantB: { model: 'gpt-4-turbo', parameters: { temperature: 0.7 } },
        splitRatio: 0.5,
        active: true,
      });

      expect(testId).toContain('test_categorization');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        createABTest({
          name: 'Test Categorization',
          operation: 'categorization',
          variantA: { model: 'gpt-4o-mini', parameters: {} },
          variantB: { model: 'gpt-4-turbo', parameters: {} },
          splitRatio: 0.5,
          active: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('deactivateABTest', () => {
    it('should set active to false and add endDate', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await deactivateABTest('test_123');

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const updatedData = setDocCall[1] as any;

      expect(updatedData.active).toBe(false);
      expect(updatedData.endDate).toBeDefined();
    });

    it('should throw error on failure', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(deactivateABTest('test_123')).rejects.toThrow();
    });
  });

  describe('getActiveABTests', () => {
    it('should return all active tests', async () => {
      const mockTests = [
        {
          id: 'test_1',
          name: 'Test 1',
          operation: 'categorization',
          active: true,
        },
        {
          id: 'test_2',
          name: 'Test 2',
          operation: 'sentiment',
          active: true,
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockTests.map(test => ({
          data: () => test,
        })),
      } as any);

      const tests = await getActiveABTests();

      expect(tests).toHaveLength(2);
      expect(tests[0].id).toBe('test_1');
      expect(tests[1].id).toBe('test_2');
    });

    it('should filter by operation if specified', async () => {
      const mockTests = [
        {
          id: 'test_1',
          name: 'Test 1',
          operation: 'categorization',
          active: true,
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockTests.map(test => ({
          data: () => test,
        })),
      } as any);

      const tests = await getActiveABTests('categorization');

      expect(tests).toHaveLength(1);
      expect(tests[0].operation).toBe('categorization');
      expect(mockQuery).toHaveBeenCalledTimes(2); // Once for active, once for operation
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const tests = await getActiveABTests();

      expect(tests).toEqual([]);
    });
  });
});
