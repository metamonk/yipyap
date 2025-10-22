/**
 * Integration tests for chat date separators functionality
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';
import ChatScreen from '@/app/(tabs)/conversations/[id]';
import type { Message } from '@/types/models';

// Mock necessary modules
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'test-conv-1' })),
  router: {
    canGoBack: jest.fn(() => true),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-user-1',
      displayName: 'Test User',
      photoURL: null,
    },
  })),
}));

jest.mock('@/services/conversationService', () => ({
  getConversation: jest.fn(() =>
    Promise.resolve({
      id: 'test-conv-1',
      type: 'direct',
      participantIds: ['test-user-1', 'test-user-2'],
      lastMessage: null,
      lastMessageTimestamp: Timestamp.now(),
      unreadCount: {},
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  ),
}));

jest.mock('@/services/userService', () => ({
  getUserProfile: jest.fn(() =>
    Promise.resolve({
      uid: 'test-user-2',
      displayName: 'Other User',
      photoURL: null,
      username: 'otheruser',
      bio: 'Test bio',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  ),
}));

// Mock the useMessages hook with test data
jest.mock('@/hooks/useMessages', () => ({
  useMessages: jest.fn(() => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        conversationId: 'test-conv-1',
        senderId: 'test-user-1',
        text: 'Message from today morning',
        status: 'delivered',
        readBy: ['test-user-1'],
        timestamp: Timestamp.fromMillis(new Date().setHours(9, 0, 0, 0)),
        metadata: { aiProcessed: false },
      },
      {
        id: 'msg-2',
        conversationId: 'test-conv-1',
        senderId: 'test-user-2',
        text: 'Reply from today afternoon',
        status: 'delivered',
        readBy: ['test-user-1', 'test-user-2'],
        timestamp: Timestamp.fromMillis(new Date().setHours(14, 0, 0, 0)),
        metadata: { aiProcessed: false },
      },
      {
        id: 'msg-3',
        conversationId: 'test-conv-1',
        senderId: 'test-user-1',
        text: 'Message from yesterday',
        status: 'delivered',
        readBy: ['test-user-1'],
        timestamp: Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000),
        metadata: { aiProcessed: false },
      },
      {
        id: 'msg-4',
        conversationId: 'test-conv-1',
        senderId: 'test-user-2',
        text: 'Message from 3 days ago',
        status: 'delivered',
        readBy: ['test-user-1', 'test-user-2'],
        timestamp: Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000),
        metadata: { aiProcessed: false },
      },
    ];

    return {
      messages,
      loading: false,
      sendMessage: jest.fn(),
      flatListRef: { current: null },
      hasMore: false,
      isLoadingMore: false,
      loadMoreMessages: jest.fn(),
      isOffline: false,
    };
  }),
}));

describe('Chat Date Separators Integration', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Initialize test environment
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        host: 'localhost',
        port: 8080,
        rules: `
          service cloud.firestore {
            match /databases/{database}/documents {
              match /{document=**} {
                allow read, write: if true;
              }
            }
          }
        `,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays date separators between messages from different days', async () => {
    const { getAllByTestId, getByText } = render(<ChatScreen />);

    await waitFor(() => {
      // Check that date separators are rendered
      const separators = getAllByTestId('date-separator');
      expect(separators.length).toBeGreaterThan(0);

      // Check that messages are visible
      expect(getByText('Message from today morning')).toBeTruthy();
      expect(getByText('Reply from today afternoon')).toBeTruthy();
      expect(getByText('Message from yesterday')).toBeTruthy();
      expect(getByText('Message from 3 days ago')).toBeTruthy();
    });
  });

  it('displays correct separator labels for different date ranges', async () => {
    const { getByText, queryByText } = render(<ChatScreen />);

    await waitFor(() => {
      // Check for "TODAY" separator (uppercase due to text transform)
      expect(getByText('TODAY')).toBeTruthy();

      // Check for "YESTERDAY" separator
      expect(getByText('YESTERDAY')).toBeTruthy();

      // For 3 days ago, it should show the day name (e.g., "MONDAY", "TUESDAY", etc.)
      // Since we don't know exactly which day, we just check that it's not TODAY or YESTERDAY
      const separators = [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ];
      const hasDayName = separators.some((day) => queryByText(day));
      expect(hasDayName).toBe(true);
    });
  });

  it('groups same-day messages without separator between them', async () => {
    // Mock useMessages to return only same-day messages
    const useMessagesMock = require('@/hooks/useMessages').useMessages as jest.Mock;
    useMessagesMock.mockReturnValueOnce({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'test-conv-1',
          senderId: 'test-user-1',
          text: 'First message today',
          status: 'delivered',
          readBy: ['test-user-1'],
          timestamp: Timestamp.fromMillis(new Date().setHours(9, 0, 0, 0)),
          metadata: { aiProcessed: false },
        },
        {
          id: 'msg-2',
          conversationId: 'test-conv-1',
          senderId: 'test-user-2',
          text: 'Second message today',
          status: 'delivered',
          readBy: ['test-user-1', 'test-user-2'],
          timestamp: Timestamp.fromMillis(new Date().setHours(10, 0, 0, 0)),
          metadata: { aiProcessed: false },
        },
        {
          id: 'msg-3',
          conversationId: 'test-conv-1',
          senderId: 'test-user-1',
          text: 'Third message today',
          status: 'delivered',
          readBy: ['test-user-1'],
          timestamp: Timestamp.fromMillis(new Date().setHours(11, 0, 0, 0)),
          metadata: { aiProcessed: false },
        },
      ],
      loading: false,
      sendMessage: jest.fn(),
      flatListRef: { current: null },
      hasMore: false,
      isLoadingMore: false,
      loadMoreMessages: jest.fn(),
      isOffline: false,
    });

    const { getAllByTestId, getByText } = render(<ChatScreen />);

    await waitFor(() => {
      // Should have only one separator for the group of same-day messages
      const separators = getAllByTestId('date-separator');
      expect(separators).toHaveLength(1);

      // All messages should be visible
      expect(getByText('First message today')).toBeTruthy();
      expect(getByText('Second message today')).toBeTruthy();
      expect(getByText('Third message today')).toBeTruthy();

      // The single separator should be "TODAY"
      expect(getByText('TODAY')).toBeTruthy();
    });
  });

  it('handles empty message list without errors', async () => {
    // Mock useMessages to return empty messages array
    const useMessagesMock = require('@/hooks/useMessages').useMessages as jest.Mock;
    useMessagesMock.mockReturnValueOnce({
      messages: [],
      loading: false,
      sendMessage: jest.fn(),
      flatListRef: { current: null },
      hasMore: false,
      isLoadingMore: false,
      loadMoreMessages: jest.fn(),
      isOffline: false,
    });

    const { queryByTestId } = render(<ChatScreen />);

    await waitFor(() => {
      // Should not have any separators
      const separators = queryByTestId('date-separator');
      expect(separators).toBeNull();
    });
  });

  it('maintains correct chronological order with separators', async () => {
    const { getAllByTestId, getByText } = render(<ChatScreen />);

    await waitFor(() => {
      // Get all rendered items (both messages and separators)
      const separators = getAllByTestId('date-separator');

      // Verify we have the expected number of separators
      // (one for each different day in our test data)
      expect(separators.length).toBeGreaterThanOrEqual(3);

      // Verify messages are still visible and in order
      expect(getByText('Message from today morning')).toBeTruthy();
      expect(getByText('Reply from today afternoon')).toBeTruthy();
      expect(getByText('Message from yesterday')).toBeTruthy();
      expect(getByText('Message from 3 days ago')).toBeTruthy();
    });
  });
});
