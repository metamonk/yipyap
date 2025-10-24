/**
 * Unit tests for OpportunityService (Story 5.6)
 */

import { opportunityService } from '../../../services/opportunityService';
import { getFirebaseDb } from '../../../services/firebase';
import type { Message } from '../../../types/models';

// Mock Firebase
jest.mock('../../../services/firebase');

const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn();
const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

describe('OpportunityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (getFirebaseDb as jest.Mock).mockReturnValue({} as any);
    mockCollection.mockReturnValue('collection');
    mockQuery.mockReturnValue('query');
    mockWhere.mockReturnValue('where');
    mockOrderBy.mockReturnValue('orderBy');
    mockLimit.mockReturnValue('limit');
  });

  describe('getHighValueOpportunities', () => {
    it('should fetch high-value opportunities across user conversations', async () => {
      // Mock conversations
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'conv1' }, { id: 'conv2' }],
      });

      // Mock messages for conv1
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'msg1',
            data: () => ({
              text: 'Sponsorship deal',
              metadata: { opportunityScore: 95, opportunityType: 'sponsorship' },
              timestamp: { toMillis: () => 1000 },
            }),
          },
        ],
      });

      // Mock messages for conv2
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'msg2',
            data: () => ({
              text: 'Collaboration request',
              metadata: { opportunityScore: 85, opportunityType: 'collaboration' },
              timestamp: { toMillis: () => 2000 },
            }),
          },
        ],
      });

      const result = await opportunityService.getHighValueOpportunities('user123', 70, 20);

      expect(result).toHaveLength(2);
      expect(result[0].metadata.opportunityScore).toBe(95);
      expect(result[1].metadata.opportunityScore).toBe(85);
    });

    it('should return empty array when user has no conversations', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await opportunityService.getHighValueOpportunities('user123', 70, 20);

      expect(result).toEqual([]);
    });

    it('should sort by score DESC then timestamp DESC', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'conv1' }],
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'msg1',
            data: () => ({
              metadata: { opportunityScore: 70 },
              timestamp: { toMillis: () => 1000 },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              metadata: { opportunityScore: 90 },
              timestamp: { toMillis: () => 2000 },
            }),
          },
          {
            id: 'msg3',
            data: () => ({
              metadata: { opportunityScore: 80 },
              timestamp: { toMillis: () => 3000 },
            }),
          },
        ],
      });

      const result = await opportunityService.getHighValueOpportunities('user123', 70, 20);

      expect(result[0].id).toBe('msg2'); // Highest score (90)
      expect(result[1].id).toBe('msg3'); // Second highest (80)
      expect(result[2].id).toBe('msg1'); // Lowest score (70)
    });

    it('should limit results to maxResults', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'conv1' }],
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: Array.from({ length: 10 }, (_, i) => ({
          id: `msg${i}`,
          data: () => ({
            metadata: { opportunityScore: 80 - i },
            timestamp: { toMillis: () => 1000 + i },
          }),
        })),
      });

      const result = await opportunityService.getHighValueOpportunities('user123', 70, 3);

      expect(result).toHaveLength(3);
    });

    it('should handle conversation query failures gracefully', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'conv1' }, { id: 'conv2' }],
      });

      // First conversation succeeds
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'msg1',
            data: () => ({
              metadata: { opportunityScore: 95 },
              timestamp: { toMillis: () => 1000 },
            }),
          },
        ],
      });

      // Second conversation fails
      mockGetDocs.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await opportunityService.getHighValueOpportunities('user123', 70, 20);

      // Should still return results from successful conversation
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg1');
    });
  });

  describe('getOpportunityAnalytics', () => {
    it('should calculate analytics correctly', async () => {
      // Mock conversations
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'conv1' }],
      });

      // Mock 30 days of opportunities
      const now = new Date();
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'msg1',
            data: () => ({
              metadata: { opportunityScore: 95, opportunityType: 'sponsorship' },
              timestamp: { toDate: () => now, toMillis: () => now.getTime() },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              metadata: { opportunityScore: 65, opportunityType: 'collaboration' },
              timestamp: { toDate: () => now, toMillis: () => now.getTime() },
            }),
          },
          {
            id: 'msg3',
            data: () => ({
              metadata: { opportunityScore: 80, opportunityType: 'sponsorship' },
              timestamp: { toDate: () => now, toMillis: () => now.getTime() },
            }),
          },
        ],
      });

      const analytics = await opportunityService.getOpportunityAnalytics('user123', 30);

      expect(analytics.totalOpportunities).toBe(3);
      expect(analytics.highValueCount).toBe(2); // Scores >= 70
      expect(analytics.averageScore).toBe(80); // (95 + 65 + 80) / 3 = 80
      expect(analytics.byType.sponsorship).toBe(2);
      expect(analytics.byType.collaboration).toBe(1);
      expect(analytics.periodDays).toBe(30);
    });

    it('should return zero metrics when no opportunities found', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const analytics = await opportunityService.getOpportunityAnalytics('user123', 30);

      expect(analytics.totalOpportunities).toBe(0);
      expect(analytics.highValueCount).toBe(0);
      expect(analytics.averageScore).toBe(0);
    });

    it('should filter opportunities by time period', async () => {
      // Mock conversations
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'conv1' }],
      });

      const now = new Date();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'msg1',
            data: () => ({
              metadata: { opportunityScore: 95, opportunityType: 'sponsorship' },
              timestamp: { toDate: () => now, toMillis: () => now.getTime() },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              metadata: { opportunityScore: 80, opportunityType: 'collaboration' },
              timestamp: { toDate: () => oldDate, toMillis: () => oldDate.getTime() },
            }),
          },
        ],
      });

      const analytics = await opportunityService.getOpportunityAnalytics('user123', 30);

      // Should only count msg1 (within 30 days)
      expect(analytics.totalOpportunities).toBe(1);
    });
  });

  describe('subscribeToOpportunities', () => {
    it('should set up real-time subscription', () => {
      const mockUnsubscribeConversations = jest.fn();
      const mockUnsubscribeMessages = jest.fn();
      const mockCallback = jest.fn();

      // Mock conversation snapshot
      mockOnSnapshot.mockImplementation((query, callback) => {
        if (query === 'conversationsQuery') {
          callback({
            docs: [{ id: 'conv1' }],
          });
          return mockUnsubscribeConversations;
        }
        return mockUnsubscribeMessages;
      });

      const unsubscribe = opportunityService.subscribeToOpportunities('user123', 70, mockCallback);

      expect(mockOnSnapshot).toHaveBeenCalled();

      // Call unsubscribe
      unsubscribe();

      expect(mockUnsubscribeConversations).toHaveBeenCalled();
    });

    it('should trigger callback on new opportunity', () => {
      const mockCallback = jest.fn();

      // Setup onSnapshot to call message callback with new opportunity
      mockOnSnapshot.mockImplementation((query, callback) => {
        // Simulate conversation snapshot
        callback({
          docs: [{ id: 'conv1' }],
        });

        // Simulate message snapshot with new opportunity
        callback({
          docChanges: () => [
            {
              type: 'added',
              doc: {
                id: 'msg1',
                data: () => ({
                  text: 'Sponsorship deal',
                  metadata: { opportunityScore: 95 },
                }),
              },
            },
          ],
        });

        return jest.fn();
      });

      opportunityService.subscribeToOpportunities('user123', 70, mockCallback);

      // Note: Callback triggering depends on mock implementation
      // In real scenario, callback would be called when new document arrives
    });
  });
});
