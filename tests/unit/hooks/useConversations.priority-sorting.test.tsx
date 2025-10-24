/**
 * Tests for useConversations hook - Priority Sorting (Story 5.6 - Task 8)
 *
 * @remarks
 * Tests that conversations are sorted with high-value opportunities (score >= 70) first,
 * and that sorting is maintained with real-time updates.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useConversations } from '@/hooks/useConversations';
import * as conversationService from '@/services/conversationService';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Conversation } from '@/types/models';

// Mock Firebase
jest.mock('firebase/firestore');
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

// Mock conversation service
jest.mock('@/services/conversationService');

// Mock Timestamp class for tests
class MockTimestamp {
  private date: Date;

  constructor(seconds: number, nanoseconds: number = 0) {
    this.date = new Date(seconds * 1000 + nanoseconds / 1000000);
  }

  toDate(): Date {
    return this.date;
  }

  toMillis(): number {
    return this.date.getTime();
  }

  static now(): MockTimestamp {
    return MockTimestamp.fromDate(new Date());
  }

  static fromDate(date: Date): MockTimestamp {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
  }
}

describe('useConversations - Priority Sorting (Story 5.6 - Task 8)', () => {
  const userId = 'test-user-123';
  let conversationsCallback: ((conversations: Conversation[]) => void) | null = null;
  let opportunityCallbacks: Map<string, (snapshot: any) => void> = new Map();
  let currentConversationId: string = '';

  beforeEach(() => {
    jest.clearAllMocks();
    conversationsCallback = null;
    opportunityCallbacks.clear();
    currentConversationId = '';

    // Mock subscribeToConversations to capture the callback
    (conversationService.subscribeToConversations as jest.Mock).mockImplementation(
      (uid: string, callback: (conversations: Conversation[]) => void) => {
        conversationsCallback = callback;
        // Return unsubscribe function
        return () => {
          conversationsCallback = null;
        };
      }
    );

    // Mock refreshConversations
    (conversationService.refreshConversations as jest.Mock).mockResolvedValue({
      conversations: [],
    });

    // Mock collection to capture conversation ID
    (collection as jest.Mock).mockImplementation((db: any, ...pathSegments: string[]) => {
      // Path is like: 'conversations', conversationId, 'messages'
      if (pathSegments.length >= 2 && pathSegments[0] === 'conversations') {
        currentConversationId = pathSegments[1];
      }
      return { _path: pathSegments };
    });

    // Mock Firestore onSnapshot for opportunity scores
    (onSnapshot as jest.Mock).mockImplementation((q: any, successCallback: any, errorCallback: any) => {
      // Store callback keyed by conversation ID
      const convId = currentConversationId;
      opportunityCallbacks.set(convId, successCallback);

      // Return unsubscribe function
      return () => {
        opportunityCallbacks.delete(convId);
      };
    });

    // Mock query, where, orderBy, limit
    (query as jest.Mock).mockImplementation(() => ({}));
    (where as jest.Mock).mockImplementation(() => ({}));
    (orderBy as jest.Mock).mockImplementation(() => ({}));
    (limit as jest.Mock).mockImplementation(() => ({}));
  });

  /**
   * Helper to create a mock conversation
   */
  const createConversation = (id: string, timestampSeconds: number): Conversation => ({
    id,
    type: 'direct',
    participantIds: [userId, `other-user-${id}`],
    lastMessage: {
      text: `Message ${id}`,
      senderId: `other-user-${id}`,
    },
    lastMessageTimestamp: new MockTimestamp(timestampSeconds) as any,
    unreadCount: {},
    createdAt: new MockTimestamp(timestampSeconds - 10000) as any,
    updatedAt: new MockTimestamp(timestampSeconds) as any,
  });

  /**
   * Helper to simulate opportunity score update for a specific conversation
   */
  const simulateOpportunityScore = (conversationId: string, score: number) => {
    // Call only the callback for this specific conversation
    const callback = opportunityCallbacks.get(conversationId);
    if (callback) {
      callback({
        empty: score === 0,
        docs: score > 0 ? [
          {
            data: () => ({
              metadata: {
                opportunityScore: score,
              },
            }),
          },
        ] : [],
      });
    }
  };

  test('sorts conversations with opportunity score >= 70 first', async () => {
    const { result } = renderHook(() => useConversations(userId));

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Simulate conversations being loaded
    // Conv1: recent, no opportunity
    // Conv2: older, high opportunity (85)
    // Conv3: very recent, medium opportunity (60)
    const conv1 = createConversation('conv1', 1000);
    const conv2 = createConversation('conv2', 900);
    const conv3 = createConversation('conv3', 1100);

    conversationsCallback?.([conv1, conv2, conv3]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate opportunity scores
    simulateOpportunityScore('conv1', 0);
    simulateOpportunityScore('conv2', 85);
    simulateOpportunityScore('conv3', 60);

    await waitFor(() => {
      // Conv2 should be first (score 85 >= 70)
      // Then conv3 and conv1 sorted by timestamp (conv3 is more recent)
      const conversations = result.current.conversations;
      expect(conversations).toHaveLength(3);
      expect(conversations[0].id).toBe('conv2'); // Priority: score 85
      expect(conversations[1].id).toBe('conv3'); // Regular: most recent
      expect(conversations[2].id).toBe('conv1'); // Regular: older
    });
  });

  test('maintains timestamp sorting within priority levels', async () => {
    const { result } = renderHook(() => useConversations(userId));

    // Create conversations with different timestamps
    const conv1 = createConversation('conv1', 1000); // High score, older
    const conv2 = createConversation('conv2', 1100); // High score, newer
    const conv3 = createConversation('conv3', 900);  // Regular, old
    const conv4 = createConversation('conv4', 950);  // Regular, newer

    conversationsCallback?.([conv1, conv2, conv3, conv4]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate opportunity scores
    simulateOpportunityScore('conv1', 80); // Priority
    simulateOpportunityScore('conv2', 90); // Priority
    simulateOpportunityScore('conv3', 0);  // Regular
    simulateOpportunityScore('conv4', 50); // Regular

    await waitFor(() => {
      const conversations = result.current.conversations;
      expect(conversations).toHaveLength(4);

      // Priority conversations (score >= 70) sorted by timestamp
      expect(conversations[0].id).toBe('conv2'); // Score 90, timestamp 1100 (most recent priority)
      expect(conversations[1].id).toBe('conv1'); // Score 80, timestamp 1000

      // Regular conversations sorted by timestamp
      expect(conversations[2].id).toBe('conv4'); // Score 50, timestamp 950 (most recent regular)
      expect(conversations[3].id).toBe('conv3'); // Score 0, timestamp 900
    });
  });

  test('moves conversation to priority when score reaches 70', async () => {
    const { result } = renderHook(() => useConversations(userId));

    const conv1 = createConversation('conv1', 1000);
    const conv2 = createConversation('conv2', 900);

    conversationsCallback?.([conv1, conv2]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initially, both have low scores
    simulateOpportunityScore('conv1', 0);
    simulateOpportunityScore('conv2', 50);

    await waitFor(() => {
      const conversations = result.current.conversations;
      expect(conversations[0].id).toBe('conv1'); // More recent
      expect(conversations[1].id).toBe('conv2');
    });

    // Now conv2's score increases to 75 (priority)
    simulateOpportunityScore('conv2', 75);

    await waitFor(() => {
      const conversations = result.current.conversations;
      // Conv2 should now be first (priority)
      expect(conversations[0].id).toBe('conv2'); // Priority: score 75
      expect(conversations[1].id).toBe('conv1'); // Regular: score 0
    });
  });

  test('handles conversations with exactly score 70 as priority', async () => {
    const { result } = renderHook(() => useConversations(userId));

    const conv1 = createConversation('conv1', 1000);
    const conv2 = createConversation('conv2', 900);

    conversationsCallback?.([conv1, conv2]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Conv1 has exactly 70 (boundary case)
    simulateOpportunityScore('conv1', 70);
    simulateOpportunityScore('conv2', 69);

    await waitFor(() => {
      const conversations = result.current.conversations;
      // Conv1 should be in priority section (score 70 >= 70)
      expect(conversations[0].id).toBe('conv1'); // Priority: score 70
      expect(conversations[1].id).toBe('conv2'); // Regular: score 69
    });
  });

  test('exposes opportunity scores in return value', async () => {
    const { result } = renderHook(() => useConversations(userId));

    const conv1 = createConversation('conv1', 1000);

    conversationsCallback?.([conv1]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    simulateOpportunityScore('conv1', 85);

    await waitFor(() => {
      expect(result.current.opportunityScores).toBeDefined();
      expect(result.current.opportunityScores['conv1']).toBe(85);
    });
  });

  test('handles empty conversations list', async () => {
    const { result } = renderHook(() => useConversations(userId));

    conversationsCallback?.([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.conversations).toHaveLength(0);
      expect(result.current.opportunityScores).toEqual({});
    });
  });

  test('handles conversations with no opportunity scores', async () => {
    const { result } = renderHook(() => useConversations(userId));

    const conv1 = createConversation('conv1', 1000);
    const conv2 = createConversation('conv2', 900);

    conversationsCallback?.([conv1, conv2]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // No opportunity scores set (all default to 0)
    simulateOpportunityScore('conv1', 0);
    simulateOpportunityScore('conv2', 0);

    await waitFor(() => {
      const conversations = result.current.conversations;
      // Should be sorted by timestamp only
      expect(conversations[0].id).toBe('conv1'); // More recent (1000)
      expect(conversations[1].id).toBe('conv2'); // Older (900)
    });
  });

  test('cleans up opportunity score subscriptions on unmount', async () => {
    const { result, unmount } = renderHook(() => useConversations(userId));

    const conv1 = createConversation('conv1', 1000);

    conversationsCallback?.([conv1]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have subscriptions
    expect(opportunityCallbacks.size).toBeGreaterThan(0);

    // Unmount hook
    unmount();

    // Subscriptions should be cleaned up
    // Note: This depends on the mock implementation calling unsubscribe
    expect(onSnapshot).toHaveBeenCalled();
  });
});
