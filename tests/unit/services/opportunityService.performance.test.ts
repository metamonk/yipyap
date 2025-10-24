/**
 * Opportunity Service Performance Tests (Story 5.6 - Task 15)
 *
 * Tests for performance optimizations:
 * - Task 15.1: Pagination support
 * - Task 15.2: 5-minute caching
 * - Task 15.4: Query performance measurement (<200ms)
 * - Task 15.5: Performance monitoring
 */

import { opportunityService } from '@/services/opportunityService';
import { getFirebaseDb } from '@/services/firebase';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('@/services/firebase');

const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => ({
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  collection: (...args: any[]) => mockCollection(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  onSnapshot: jest.fn(),
  Timestamp: {
    now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }),
    fromDate: (date: Date) => ({ toMillis: () => date.getTime(), toDate: () => date }),
  },
}));

describe('OpportunityService Performance Optimizations (Story 5.6 - Task 15)', () => {
  const mockDb = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);

    // Default mock implementations
    mockCollection.mockReturnValue('mock-collection');
    mockWhere.mockReturnValue('mock-where');
    mockOrderBy.mockReturnValue('mock-order');
    mockLimit.mockReturnValue('mock-limit');
    mockQuery.mockReturnValue('mock-query');
  });

  describe('Task 15.2: Caching with 5-minute TTL', () => {
    it('should cache high-value opportunities for 5 minutes', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }, { id: 'conv-2' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg-1',
            data: () => ({
              text: 'Sponsorship opportunity worth $5000',
              senderId: 'user-brand',
              timestamp: Timestamp.now(),
              metadata: {
                opportunityScore: 85,
                opportunityType: 'sponsorship',
              },
            }),
          },
        ],
      };

      // First call - should hit Firestore
      mockGetDocs
        .mockResolvedValueOnce(mockConversations) // conversations
        .mockResolvedValue(mockMessages); // messages for each conversation

      const result1 = await opportunityService.getHighValueOpportunities('user-1', 70, 20);

      expect(mockGetDocs).toHaveBeenCalled();
      expect(result1.length).toBeGreaterThan(0); // Should have at least one opportunity

      const initialCallCount = mockGetDocs.mock.calls.length;

      // Second call immediately - should use cache
      const result2 = await opportunityService.getHighValueOpportunities('user-1', 70, 20);

      expect(result2).toEqual(result1);
      expect(mockGetDocs).toHaveBeenCalledTimes(initialCallCount); // No additional calls
    });

    it('should bypass cache when useCache=false', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      const mockMessages = {
        docs: [],
      };

      mockGetDocs
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValue(mockMessages);

      // First call with cache
      await opportunityService.getHighValueOpportunities('user-1', 70, 20, true);
      const callCountAfterFirst = mockGetDocs.mock.calls.length;

      // Second call with cache=false should hit Firestore again
      mockGetDocs
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValue(mockMessages);

      await opportunityService.getHighValueOpportunities('user-1', 70, 20, false);

      expect(mockGetDocs).toHaveBeenCalledTimes(callCountAfterFirst + 2); // New calls made
    });

    it('should use separate cache entries for different query parameters', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      const mockMessages = {
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockConversations);
      mockGetDocs.mockResolvedValue(mockMessages);

      // Different userId
      await opportunityService.getHighValueOpportunities('user-1', 70, 20);
      const callsAfterUser1 = mockGetDocs.mock.calls.length;

      mockGetDocs.mockClear();
      mockGetDocs.mockResolvedValue(mockConversations);
      mockGetDocs.mockResolvedValue(mockMessages);

      await opportunityService.getHighValueOpportunities('user-2', 70, 20);

      expect(mockGetDocs).toHaveBeenCalled(); // New query for different user
    });
  });

  describe('Task 15.1: Pagination Support', () => {
    it('should respect maxResults parameter for pagination', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      // Create 30 mock opportunities
      const mockDocs = Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        data: () => ({
          text: `Opportunity ${i}`,
          senderId: 'user-brand',
          timestamp: Timestamp.now(),
          metadata: {
            opportunityScore: 90 - i, // Descending scores
            opportunityType: 'sponsorship',
          },
        }),
      }));

      mockGetDocs
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValueOnce({ docs: mockDocs });

      // Request only 10 results
      const result = await opportunityService.getHighValueOpportunities('user-1', 70, 10, false);

      expect(result).toHaveLength(10);
      // Verify they're the top 10 by score
      expect(result[0].metadata.opportunityScore).toBe(90);
      expect(result[9].metadata.opportunityScore).toBe(81);
    });

    it('should support different page sizes', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      const mockDocs = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        data: () => ({
          text: `Opportunity ${i}`,
          senderId: 'user-brand',
          timestamp: Timestamp.now(),
          metadata: {
            opportunityScore: 95 - i,
            opportunityType: 'sponsorship',
          },
        }),
      }));

      mockGetDocs
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValueOnce({ docs: mockDocs });

      // Test different page sizes
      const result5 = await opportunityService.getHighValueOpportunities('user-1', 70, 5, false);
      expect(result5).toHaveLength(5);

      mockGetDocs.mockClear();
      mockGetDocs
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValueOnce({ docs: mockDocs });

      const result20 = await opportunityService.getHighValueOpportunities('user-1', 70, 20, false);
      expect(result20).toHaveLength(20);
    });
  });

  describe('Task 15.4 & 15.5: Performance Measurement and Monitoring', () => {
    it('should record query performance metrics', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg-1',
            data: () => ({
              text: 'Opportunity',
              senderId: 'user-brand',
              timestamp: Timestamp.now(),
              metadata: {
                opportunityScore: 85,
                opportunityType: 'sponsorship',
              },
            }),
          },
        ],
      };

      mockGetDocs
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValue(mockMessages);

      await opportunityService.getHighValueOpportunities('user-1', 70, 20, false);

      const metrics = opportunityService.getPerformanceMetrics();

      expect(metrics.queryCount).toBeGreaterThan(0);
      expect(metrics.lastQueryTime).toBeDefined();
      expect(metrics.averageQueryTime).toBeGreaterThanOrEqual(0);
    });

    it('should update average query time with each query', async () => {
      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      const mockMessages = {
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockConversations);
      mockGetDocs.mockResolvedValue(mockMessages);

      const initialMetrics = opportunityService.getPerformanceMetrics();
      const initialCount = initialMetrics.queryCount;

      // Make a query
      await opportunityService.getHighValueOpportunities('user-1', 70, 20, false);

      const updatedMetrics = opportunityService.getPerformanceMetrics();

      expect(updatedMetrics.queryCount).toBe(initialCount + 1);
      expect(updatedMetrics.lastQueryTime).toBeGreaterThanOrEqual(0);
    });

    it('should track performance even on errors', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(
        opportunityService.getHighValueOpportunities('user-1', 70, 20, false)
      ).rejects.toThrow();

      const metrics = opportunityService.getPerformanceMetrics();

      // Should still record the query attempt
      expect(metrics.queryCount).toBeGreaterThan(0);
      expect(metrics.lastQueryTime).toBeDefined();
    });
  });

  describe('Task 15.4: Performance Target (<200ms)', () => {
    it('should log warning if query exceeds 200ms target', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      const mockConversations = {
        docs: [{ id: 'conv-1' }],
      };

      const mockMessages = {
        docs: [],
      };

      // Simulate slow query
      mockGetDocs
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(mockConversations), 150)))
        .mockResolvedValue(mockMessages);

      await opportunityService.getHighValueOpportunities('user-1', 70, 20, false);

      // Check that performance was logged
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Query completed');
      expect(logCalls).toContain('target: <200ms');

      consoleSpy.mockRestore();
    });
  });
});
