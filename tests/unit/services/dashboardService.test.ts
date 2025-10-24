/**
 * Unit tests for Dashboard Service
 *
 * @remarks
 * Tests dashboard data aggregation, priority scoring, and real-time updates
 */

import { dashboardService, DashboardService } from '../../../services/dashboardService';
import { getFirebaseDb } from '../../../services/firebase';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('../../../services/firebase', () => ({
  getFirebaseDb: jest.fn(),
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  Timestamp: {
    fromDate: (date: Date) => ({ toDate: () => date, toMillis: () => date.getTime() }),
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
  },
}));

describe('DashboardService', () => {
  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Firestore
    mockFirestore = {
      collection: jest.fn(),
    };

    (getFirebaseDb as jest.Mock).mockReturnValue(mockFirestore);
  });

  describe('getDailySummary', () => {
    it('should calculate overnight message metrics correctly', async () => {
      // Mock conversations query
      const { getDocs, query, collection, where } = require('firebase/firestore');

      const mockConversations = {
        docs: [
          { id: 'conv1' },
          { id: 'conv2' },
        ],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user123',
              text: 'Test message',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'fan_engagement',
                sentiment: 'positive',
                sentimentScore: 0.8,
              },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              senderId: 'user456',
              text: 'Business opportunity',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'business_opportunity',
                opportunityScore: 85,
                sentiment: 'positive',
                sentimentScore: 0.6,
              },
            }),
          },
          {
            id: 'msg3',
            data: () => ({
              senderId: 'user789',
              text: 'Urgent issue',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'urgent',
                sentiment: 'negative',
                sentimentScore: -0.7,
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        // First call returns conversations
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        // Subsequent calls return messages
        return Promise.resolve(mockMessages);
      });

      const summary = await dashboardService.getDailySummary('user123');

      expect(summary.userId).toBe('user123');
      expect(summary.period).toBe('overnight');
      expect(summary.messagingMetrics.totalMessages).toBe(6); // 3 messages * 2 conversations
      expect(summary.messagingMetrics.byCategory.fan_engagement).toBe(2);
      expect(summary.messagingMetrics.byCategory.business_opportunity).toBe(2);
      expect(summary.messagingMetrics.highValueOpportunities).toBe(2); // opportunityScore >= 70
      expect(summary.messagingMetrics.crisisMessages).toBe(2); // negative + urgent
      expect(summary.sentimentMetrics.positiveCount).toBe(4);
      expect(summary.sentimentMetrics.negativeCount).toBe(2);
    });

    it('should handle empty message list', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const summary = await dashboardService.getDailySummary('user123');

      expect(summary.messagingMetrics.totalMessages).toBe(0);
      expect(summary.faqMetrics.faqMatchRate).toBe(0);
    });

    it('should calculate FAQ metrics correctly', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user123',
              text: 'FAQ question',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                isFAQ: true,
                autoResponseSent: true,
                faqTemplateId: 'template1',
              },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              senderId: 'user456',
              text: 'New FAQ question',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                isFAQ: true,
                // No faqTemplateId = new question
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const summary = await dashboardService.getDailySummary('user123');

      expect(summary.faqMetrics.newQuestionsDetected).toBe(1);
      expect(summary.faqMetrics.autoResponsesSent).toBe(1);
      expect(summary.faqMetrics.faqMatchRate).toBe(50); // 1 auto-response / 2 messages
    });

    it('should calculate voice matching metrics correctly', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user123',
              text: 'Response',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                suggestedResponse: 'AI suggestion',
                suggestionUsed: true,
              },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              senderId: 'user123',
              text: 'Response 2',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                suggestedResponse: 'AI suggestion 2',
                suggestionEdited: true,
              },
            }),
          },
          {
            id: 'msg3',
            data: () => ({
              senderId: 'user123',
              text: 'Response 3',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                suggestedResponse: 'AI suggestion 3',
                suggestionRejected: true,
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const summary = await dashboardService.getDailySummary('user123');

      expect(summary.voiceMatchingMetrics.suggestionsGenerated).toBe(3);
      expect(summary.voiceMatchingMetrics.suggestionsAccepted).toBe(1);
      expect(summary.voiceMatchingMetrics.suggestionsEdited).toBe(1);
      expect(summary.voiceMatchingMetrics.suggestionsRejected).toBe(1);
      expect(summary.voiceMatchingMetrics.acceptanceRate).toBeCloseTo(33.33, 1);
    });

    it('should handle errors gracefully', async () => {
      const { getDocs } = require('firebase/firestore');

      getDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(dashboardService.getDailySummary('user123')).rejects.toThrow(
        'Failed to retrieve daily summary'
      );
    });
  });

  describe('getPriorityMessages', () => {
    it('should calculate priority scores correctly', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockUrgentMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user456',
              text: 'Crisis message',
              timestamp: Timestamp.fromDate(new Date()),
              conversationId: 'conv1',
              metadata: {
                category: 'urgent',
                sentiment: 'negative',
                sentimentScore: -0.9,
              },
            }),
          },
        ],
      };

      const mockOpportunityMessages = {
        docs: [
          {
            id: 'msg2',
            data: () => ({
              senderId: 'user789',
              text: 'High-value opportunity',
              timestamp: Timestamp.fromDate(new Date()),
              conversationId: 'conv1',
              metadata: {
                category: 'business_opportunity',
                opportunityScore: 90,
                opportunityType: 'sponsorship',
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        // Alternate between urgent and opportunity messages
        if (getDocs.mock.calls.length % 2 === 0) {
          return Promise.resolve(mockUrgentMessages);
        }
        return Promise.resolve(mockOpportunityMessages);
      });

      const priorities = await dashboardService.getPriorityMessages('user123', 10);

      expect(priorities.length).toBe(2);

      // Crisis should be first (priority 100)
      expect(priorities[0].priorityType).toBe('crisis');
      expect(priorities[0].priorityScore).toBe(100);
      expect(priorities[0].isCrisis).toBe(true);

      // High-value opportunity should be second
      expect(priorities[1].priorityType).toBe('high_value_opportunity');
      expect(priorities[1].priorityScore).toBe(90);
    });

    it('should limit results to maxResults parameter', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: Array.from({ length: 10 }, (_, i) => ({
          id: `msg${i}`,
          data: () => ({
            senderId: `user${i}`,
            text: `Message ${i}`,
            timestamp: Timestamp.fromDate(new Date(Date.now() - i * 1000)),
            conversationId: 'conv1',
            metadata: {
              category: 'urgent',
            },
          }),
        })),
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const priorities = await dashboardService.getPriorityMessages('user123', 5);

      expect(priorities.length).toBe(5);
    });

    it('should deduplicate messages appearing in both queries', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const duplicateMessage = {
        id: 'msg1',
        data: () => ({
          senderId: 'user456',
          text: 'Urgent opportunity',
          timestamp: Timestamp.fromDate(new Date()),
          conversationId: 'conv1',
          metadata: {
            category: 'urgent',
            opportunityScore: 85,
          },
        }),
      };

      const mockMessages = {
        docs: [duplicateMessage],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const priorities = await dashboardService.getPriorityMessages('user123', 10);

      // Should only have 1 message, not 2 (deduplication)
      expect(priorities.length).toBe(1);
    });
  });

  describe('getAIPerformanceMetrics', () => {
    it('should calculate time saved metrics correctly', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user123',
              text: 'Message',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'fan_engagement',
                autoResponseSent: true, // 2 minutes saved
              },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              senderId: 'user123',
              text: 'Message',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'general',
                suggestionUsed: true, // 1.5 minutes saved
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const metrics = await dashboardService.getAIPerformanceMetrics('user123', '7days');

      expect(metrics.timeSavedMetrics.fromAutoResponses).toBe(2);
      expect(metrics.timeSavedMetrics.fromSuggestions).toBe(1.5);
      expect(metrics.timeSavedMetrics.fromCategorization).toBe(0.5); // 2 messages * 0.25
      expect(metrics.timeSavedMetrics.totalMinutesSaved).toBe(4); // 2 + 1.5 + 0.5
    });

    it('should calculate cost metrics correctly', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user123',
              text: 'Message',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'fan_engagement', // categorization + sentiment
              },
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              senderId: 'user123',
              text: 'Message',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'business_opportunity',
                opportunityScore: 85, // opportunity scoring
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const metrics = await dashboardService.getAIPerformanceMetrics('user123', '7days');

      expect(metrics.costMetrics.byCost.categorization).toBeGreaterThan(0);
      expect(metrics.costMetrics.byCost.sentiment).toBeGreaterThan(0);
      expect(metrics.costMetrics.byCost.opportunityScoring).toBeGreaterThan(0);
      expect(metrics.costMetrics.totalCostUSD).toBeGreaterThan(0);
      expect(metrics.costMetrics.averageCostPerMessage).toBeGreaterThan(0);
    });

    it('should calculate performance trends', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              senderId: 'user123',
              text: 'Message',
              timestamp: Timestamp.fromDate(new Date()),
              metadata: {
                category: 'fan_engagement',
              },
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const metrics = await dashboardService.getAIPerformanceMetrics('user123', '7days');

      expect(metrics.performanceTrends).toBeDefined();
      expect(metrics.performanceTrends.length).toBe(7); // 7 days
      expect(metrics.performanceTrends[0]).toHaveProperty('date');
      expect(metrics.performanceTrends[0]).toHaveProperty('accuracy');
      expect(metrics.performanceTrends[0]).toHaveProperty('timeSaved');
      expect(metrics.performanceTrends[0]).toHaveProperty('cost');
    });
  });

  describe('subscribeToDashboardUpdates', () => {
    it('should setup real-time subscription', () => {
      const { onSnapshot } = require('firebase/firestore');
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      onSnapshot.mockReturnValue(mockUnsubscribe);

      const unsubscribe = dashboardService.subscribeToDashboardUpdates('user123', mockCallback);

      expect(onSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should throttle updates to 1 per second', async () => {
      const { onSnapshot, getDocs } = require('firebase/firestore');
      const mockCallback = jest.fn();
      let snapshotCallback: any;

      onSnapshot.mockImplementation((query: any, callback: any) => {
        snapshotCallback = callback;
        return jest.fn();
      });

      getDocs.mockResolvedValue({ docs: [] });

      dashboardService.subscribeToDashboardUpdates('user123', mockCallback);

      // Trigger multiple updates quickly
      await snapshotCallback();
      await snapshotCallback();
      await snapshotCallback();

      // Should only process one update due to throttling
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
});
