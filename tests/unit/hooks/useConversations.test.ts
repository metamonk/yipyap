/**
 * Unit tests for useConversations hook
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useConversations } from '@/hooks/useConversations';
import { Timestamp } from 'firebase/firestore';
import type { Conversation } from '@/types/models';

// Mock Firebase Timestamp
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
  },
}));

// Mock the conversationService
jest.mock('@/services/conversationService', () => ({
  subscribeToConversations: jest.fn(),
  refreshConversations: jest.fn(),
}));

import { subscribeToConversations, refreshConversations } from '@/services/conversationService';

describe('useConversations', () => {
  const mockConversations: Conversation[] = [
    {
      id: 'conv1',
      type: 'direct',
      participantIds: ['user1', 'user2'],
      lastMessage: {
        text: 'Hello!',
        senderId: 'user2',
        timestamp: Timestamp.now(),
      },
      lastMessageTimestamp: Timestamp.now(),
      unreadCount: { user1: 2, user2: 0 },
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: 'conv2',
      type: 'direct',
      participantIds: ['user1', 'user3'],
      lastMessage: {
        text: 'Hey there!',
        senderId: 'user3',
        timestamp: Timestamp.now(),
      },
      lastMessageTimestamp: Timestamp.now(),
      unreadCount: { user1: 0, user3: 0 },
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to conversations on mount', async () => {
    const mockUnsubscribe = jest.fn();

    (subscribeToConversations as jest.Mock).mockImplementation((userId, callback) => {
      callback(mockConversations);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useConversations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(subscribeToConversations).toHaveBeenCalledTimes(1);
    expect(subscribeToConversations).toHaveBeenCalledWith('user1', expect.any(Function));
    expect(result.current.conversations).toEqual(mockConversations);
  });

  it('unsubscribes on unmount', () => {
    const mockUnsubscribe = jest.fn();

    (subscribeToConversations as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useConversations('user1'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles loading state correctly', async () => {
    const mockUnsubscribe = jest.fn();

    (subscribeToConversations as jest.Mock).mockImplementation((userId, callback) => {
      // Simulate delayed callback
      setTimeout(() => callback(mockConversations), 100);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useConversations('user1'));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.conversations).toEqual([]);

    // After callback
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.conversations).toEqual(mockConversations);
  });

  it('updates conversations when Firestore listener fires', async () => {
    const mockUnsubscribe = jest.fn();
    let fireCallback: (conversations: Conversation[]) => void = () => {};

    (subscribeToConversations as jest.Mock).mockImplementation((userId, callback) => {
      fireCallback = callback;
      callback(mockConversations);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useConversations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.conversations).toEqual(mockConversations);

    // Simulate new conversation
    const updatedConversations: Conversation[] = [
      ...mockConversations,
      {
        id: 'conv3',
        type: 'direct',
        participantIds: ['user1', 'user4'],
        lastMessage: {
          text: 'New message!',
          senderId: 'user4',
          timestamp: Timestamp.now(),
        },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { user1: 1, user4: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    fireCallback(updatedConversations);

    await waitFor(() => {
      expect(result.current.conversations).toEqual(updatedConversations);
    });
  });

  it('handles empty userId', () => {
    const { result } = renderHook(() => useConversations(''));

    expect(result.current.loading).toBe(false);
    expect(result.current.conversations).toEqual([]);
    expect(subscribeToConversations).not.toHaveBeenCalled();
  });

  it('handles refresh function', async () => {
    const mockUnsubscribe = jest.fn();

    (subscribeToConversations as jest.Mock).mockImplementation((userId, callback) => {
      callback(mockConversations);
      return mockUnsubscribe;
    });

    (refreshConversations as jest.Mock).mockResolvedValue(mockConversations);

    const { result } = renderHook(() => useConversations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call refresh
    await result.current.refresh();

    expect(refreshConversations).toHaveBeenCalledWith('user1');
  });

  it('sets refreshing state during refresh', async () => {
    const mockUnsubscribe = jest.fn();

    (subscribeToConversations as jest.Mock).mockImplementation((userId, callback) => {
      callback(mockConversations);
      return mockUnsubscribe;
    });

    (refreshConversations as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockConversations), 100))
    );

    const { result } = renderHook(() => useConversations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start refresh
    const refreshPromise = result.current.refresh();

    // Should be refreshing
    await waitFor(() => {
      expect(result.current.refreshing).toBe(true);
    });

    // Wait for refresh to complete
    await refreshPromise;

    // Should no longer be refreshing
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('handles subscription errors', async () => {
    const mockError = new Error('Subscription failed');

    (subscribeToConversations as jest.Mock).mockImplementation(() => {
      throw mockError;
    });

    const { result } = renderHook(() => useConversations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.conversations).toEqual([]);
  });

  it('handles refresh errors', async () => {
    const mockUnsubscribe = jest.fn();

    (subscribeToConversations as jest.Mock).mockImplementation((userId, callback) => {
      callback(mockConversations);
      return mockUnsubscribe;
    });

    const mockError = new Error('Refresh failed');
    (refreshConversations as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useConversations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call refresh
    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.refreshing).toBe(false);
    });
  });
});
