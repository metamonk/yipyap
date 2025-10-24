/**
 * Unit tests for AI Cost Monitoring Service
 */

import {
  calculateOperationCost,
  trackModelUsage,
  getDailyCosts,
  getMonthlyCosts,
  checkBudgetThreshold,
} from '../../../services/aiCostMonitoringService';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn((value) => ({ _increment: value })),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: jest.fn((date) => ({ toMillis: () => date.getTime() })),
  },
}));

// Mock Firebase service
jest.mock('../../../services/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({})),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;

describe('aiCostMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirestore.mockReturnValue({} as any);
    mockDoc.mockReturnValue({} as any);
  });

  describe('calculateOperationCost', () => {
    it('should calculate cost for gpt-4o-mini correctly', () => {
      // gpt-4o-mini: $0.15 per 1M input, $0.60 per 1M output
      // 100 input tokens: (100 * 0.15 / 1,000,000) * 100 = 0.0015 cents
      // 50 output tokens: (50 * 0.60 / 1,000,000) * 100 = 0.003 cents
      // Total: 0.0045 cents, rounded to 0 cents (too small)
      const cost = calculateOperationCost('gpt-4o-mini', 100, 50);
      expect(cost).toBe(0); // Very small amount rounds to 0
    });

    it('should calculate cost for gpt-4-turbo correctly', () => {
      // gpt-4-turbo: $10.00 per 1M input, $30.00 per 1M output
      // 1000 input tokens: (1000 * 10.00 / 1,000,000) * 100 = 1 cent
      // 500 output tokens: (500 * 30.00 / 1,000,000) * 100 = 1.5 cents
      // Total: 2.5 cents
      const cost = calculateOperationCost('gpt-4-turbo', 1000, 500);
      expect(cost).toBe(2.5);
    });

    it('should handle large token counts', () => {
      // 100,000 input tokens with gpt-4-turbo
      // (100,000 * 10.00 / 1,000,000) * 100 = 100 cents
      const cost = calculateOperationCost('gpt-4-turbo', 100000, 0);
      expect(cost).toBe(100);
    });

    it('should fallback to gpt-4o-mini pricing for unknown models', () => {
      const cost1 = calculateOperationCost('unknown-model', 10000, 5000);
      const cost2 = calculateOperationCost('gpt-4o-mini', 10000, 5000);
      expect(cost1).toBe(cost2);
    });

    it('should handle model variants with + separator', () => {
      // "gpt-4o-mini + gpt-4-turbo" should extract "gpt-4o-mini"
      const cost = calculateOperationCost('gpt-4o-mini + gpt-4-turbo', 10000, 5000);
      const expectedCost = calculateOperationCost('gpt-4o-mini', 10000, 5000);
      expect(cost).toBe(expectedCost);
    });
  });

  describe('trackModelUsage', () => {
    it('should create new daily cost document if none exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      mockSetDoc.mockResolvedValue(undefined);

      await trackModelUsage('user123', 'categorization', 'gpt-4o-mini', 10000, 5000, 'daily');

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user123',
          period: 'daily',
          totalCostCents: expect.any(Number),
          costByOperation: { categorization: expect.any(Number) },
          costByModel: { 'gpt-4o-mini': expect.any(Number) },
          budgetLimitCents: 500,
          totalTokens: 15000,
          tokensByOperation: { categorization: 15000 },
        })
      );
    });

    it('should update existing cost document with atomic increments', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          totalCostCents: 100,
          costByOperation: { categorization: 50 },
          costByModel: { 'gpt-4o-mini': 100 },
          budgetLimitCents: 500,
          budgetUsedPercent: 20,
          budgetAlertSent: false,
          budgetExceeded: false,
          totalTokens: 50000,
          tokensByOperation: { categorization: 50000 },
        }),
      } as any);

      mockUpdateDoc.mockResolvedValue(undefined);

      await trackModelUsage('user123', 'categorization', 'gpt-4o-mini', 10000, 5000, 'daily');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should set budgetAlertSent when crossing 80% threshold', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          totalCostCents: 395, // 79% of 500
          budgetLimitCents: 500,
          budgetUsedPercent: 79,
          budgetAlertSent: false,
          budgetExceeded: false,
        }),
      } as any);

      mockUpdateDoc.mockResolvedValue(undefined);

      // Add enough to cross 80% threshold (will add ~8.5 cents to reach ~80.7%)
      await trackModelUsage('user123', 'categorization', 'gpt-4-turbo', 5000, 2500, 'daily');

      // Should have called updateDoc at least twice (once for costs, once for budget status)
      expect(mockUpdateDoc).toHaveBeenCalled();
      // Last call should include budget status update
      const calls = (mockUpdateDoc as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toMatchObject(
        expect.objectContaining({
          budgetAlertSent: true,
          budgetUsedPercent: expect.any(Number),
        })
      );
    });

    it('should not throw on Firestore errors (circuit breaker)', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        trackModelUsage('user123', 'categorization', 'gpt-4o-mini', 1000, 500, 'daily')
      ).resolves.not.toThrow();
    });
  });

  describe('getDailyCosts', () => {
    it('should retrieve daily costs for a specific date', async () => {
      const mockCostData = {
        period: 'daily',
        totalCostCents: 250,
        costByOperation: { categorization: 150, voice_matching: 100 },
        budgetLimitCents: 500,
        budgetUsedPercent: 50,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockCostData,
      } as any);

      const result = await getDailyCosts('user123');

      expect(result).toMatchObject({
        userId: 'user123',
        totalCostCents: 250,
      });
    });

    it('should return null if no costs recorded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await getDailyCosts('user123');
      expect(result).toBeNull();
    });

    it('should throw on Firestore errors', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(getDailyCosts('user123')).rejects.toThrow(
        'Unable to load daily cost metrics. Please try again.'
      );
    });
  });

  describe('getMonthlyCosts', () => {
    it('should retrieve monthly costs for a specific month', async () => {
      const mockCostData = {
        period: 'monthly',
        totalCostCents: 5000,
        costByOperation: { categorization: 3000, voice_matching: 2000 },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockCostData,
      } as any);

      const result = await getMonthlyCosts('user123', 2025, 10);

      expect(result).toMatchObject({
        userId: 'user123',
        totalCostCents: 5000,
      });
    });

    it('should return null if no costs recorded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await getMonthlyCosts('user123', 2025, 10);
      expect(result).toBeNull();
    });

    it('should use current month if not specified', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await getMonthlyCosts('user123');

      // Should generate document ID with current year/month
      expect(mockDoc).toHaveBeenCalled();
    });
  });

  describe('checkBudgetThreshold', () => {
    it('should return exceeded=true when threshold crossed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          totalCostCents: 450,
          budgetLimitCents: 500,
          budgetUsedPercent: 90,
        }),
      } as any);

      const result = await checkBudgetThreshold('user123', 0.8);

      expect(result.exceeded).toBe(true);
      expect(result.usedPercent).toBe(90);
      expect(result.totalCostCents).toBe(450);
    });

    it('should return exceeded=false when under threshold', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          totalCostCents: 300,
          budgetLimitCents: 500,
          budgetUsedPercent: 60,
        }),
      } as any);

      const result = await checkBudgetThreshold('user123', 0.8);

      expect(result.exceeded).toBe(false);
      expect(result.usedPercent).toBe(60);
    });

    it('should return safe defaults when no costs recorded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await checkBudgetThreshold('user123');

      expect(result.exceeded).toBe(false);
      expect(result.usedPercent).toBe(0);
      expect(result.totalCostCents).toBe(0);
      expect(result.budgetLimitCents).toBe(500);
    });

    it('should return safe defaults on Firestore errors (circuit breaker)', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await checkBudgetThreshold('user123');

      expect(result.exceeded).toBe(false);
      expect(result.usedPercent).toBe(0);
    });
  });
});
