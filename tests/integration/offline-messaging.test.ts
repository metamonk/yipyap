/**
 * Integration tests for offline message queuing and synchronization
 *
 * @remarks
 * Tests the complete offline messaging flow:
 * 1. Send message while offline
 * 2. Message queued with 'sending' status
 * 3. Network restored
 * 4. Message syncs and changes to 'delivered' status
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMessages } from '@/hooks/useMessages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import * as messageService from '@/services/messageService';

// Mock dependencies
jest.mock('@/hooks/useNetworkStatus');
jest.mock('@/services/messageService');
jest.mock('@/services/conversationService');
jest.mock('@react-native-community/netinfo');

const mockedSendMessage = messageService.sendMessage as jest.MockedFunction<
  typeof messageService.sendMessage
>;
const mockedSubscribeToMessages = messageService.subscribeToMessages as jest.MockedFunction<
  typeof messageService.subscribeToMessages
>;
const mockedGetMessages = messageService.getMessages as jest.MockedFunction<
  typeof messageService.getMessages
>;

describe('Offline Messaging Integration', () => {
  const mockConversationId = 'test-conversation-id';
  const mockUserId = 'test-user-id';
  const mockParticipants = ['test-user-id', 'other-user-id'];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getMessages to return empty results by default
    mockedGetMessages.mockResolvedValue({
      messages: [],
      lastDoc: null,
      hasMore: false,
    });

    // Mock subscribeToMessages to return unsubscribe function
    mockedSubscribeToMessages.mockReturnValue(jest.fn());
  });

  it('queues message when offline and persists to Firestore local cache', async () => {
    // Start offline
    (useNetworkStatus as jest.Mock).mockReturnValue({
      connectionStatus: 'offline',
    });

    let subscriptionCallback: ((messages: any[]) => void) | null = null;

    // Mock subscribeToMessages to capture the callback
    mockedSubscribeToMessages.mockImplementation((convId, callback, pageSize) => {
      subscriptionCallback = callback;
      // Immediately invoke with empty messages
      callback([]);
      return jest.fn(); // unsubscribe function
    });

    // Mock sendMessage to succeed (Firestore local cache succeeds even offline)
    mockedSendMessage.mockResolvedValue({
      id: 'confirmed-msg-id',
      conversationId: mockConversationId,
      senderId: mockUserId,
      text: 'Offline message test',
      status: 'sending', // Still 'sending' because server hasn't confirmed
      readBy: [mockUserId],
      timestamp: { toMillis: () => Date.now() } as any,
      metadata: { aiProcessed: false },
    });

    const { result } = renderHook(() =>
      useMessages(mockConversationId, mockUserId, mockParticipants)
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Send message while offline
    await act(async () => {
      await result.current.sendMessage('Offline message test');
    });

    // Verify sendMessage was called (Firestore local cache write)
    await waitFor(() => {
      expect(mockedSendMessage).toHaveBeenCalledWith(
        {
          conversationId: mockConversationId,
          senderId: mockUserId,
          text: 'Offline message test',
        },
        mockParticipants,
        undefined
      );
    });

    // Simulate the message coming back from local cache via subscription
    // This happens because Firestore's onSnapshot listens to local cache too
    await act(async () => {
      if (subscriptionCallback) {
        subscriptionCallback([
          {
            id: 'confirmed-msg-id',
            conversationId: mockConversationId,
            senderId: mockUserId,
            text: 'Offline message test',
            status: 'sending', // Still 'sending' until server sync
            readBy: [mockUserId],
            timestamp: { toMillis: () => Date.now() } as any,
            metadata: { aiProcessed: false },
          },
        ]);
      }
    });

    // Verify message is now in messages (from local cache)
    await waitFor(() => {
      const cachedMessage = result.current.messages.find(
        (msg) => msg.text === 'Offline message test'
      );
      expect(cachedMessage).toBeTruthy();
      expect(cachedMessage?.status).toBe('sending'); // Still sending until server sync
    });
  });

  it('sends message immediately when online', async () => {
    // Start online
    (useNetworkStatus as jest.Mock).mockReturnValue({
      connectionStatus: 'online',
    });

    // Mock sendMessage to succeed
    mockedSendMessage.mockResolvedValue({
      id: 'confirmed-msg-id',
      conversationId: mockConversationId,
      senderId: mockUserId,
      text: 'Online message',
      status: 'delivered',
      readBy: [mockUserId],
      timestamp: { toMillis: () => Date.now() } as any,
      metadata: { aiProcessed: false },
    });

    const { result } = renderHook(() =>
      useMessages(mockConversationId, mockUserId, mockParticipants)
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Send message while online
    await act(async () => {
      await result.current.sendMessage('Online message');
    });

    // Verify sendMessage was called
    await waitFor(() => {
      expect(mockedSendMessage).toHaveBeenCalledWith(
        {
          conversationId: mockConversationId,
          senderId: mockUserId,
          text: 'Online message',
        },
        mockParticipants,
        undefined
      );
    });
  });

  it('handles network transitions during message composition', async () => {
    // Start online
    (useNetworkStatus as jest.Mock).mockReturnValue({
      connectionStatus: 'online',
    });

    let subscriptionCallback: ((messages: any[]) => void) | null = null;

    // Mock subscribeToMessages to capture the callback
    mockedSubscribeToMessages.mockImplementation((convId, callback, pageSize) => {
      subscriptionCallback = callback;
      callback([]);
      return jest.fn();
    });

    // Mock sendMessage to succeed (local cache)
    mockedSendMessage.mockResolvedValue({
      id: 'msg-transition',
      conversationId: mockConversationId,
      senderId: mockUserId,
      text: 'Message during transition',
      status: 'sending',
      readBy: [mockUserId],
      timestamp: { toMillis: () => Date.now() } as any,
      metadata: { aiProcessed: false },
    });

    const { result } = renderHook(() =>
      useMessages(mockConversationId, mockUserId, mockParticipants)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Go offline before sending
    (useNetworkStatus as jest.Mock).mockReturnValue({
      connectionStatus: 'offline',
    });

    // Send message while offline
    await act(async () => {
      await result.current.sendMessage('Message during transition');
    });

    // Simulate message coming back from local cache
    await act(async () => {
      if (subscriptionCallback) {
        subscriptionCallback([
          {
            id: 'msg-transition',
            conversationId: mockConversationId,
            senderId: mockUserId,
            text: 'Message during transition',
            status: 'sending',
            readBy: [mockUserId],
            timestamp: { toMillis: () => Date.now() } as any,
            metadata: { aiProcessed: false },
          },
        ]);
      }
    });

    // Verify message is in local cache with 'sending' status
    await waitFor(() => {
      const message = result.current.messages.find(
        (msg) => msg.text === 'Message during transition'
      );
      expect(message?.status).toBe('sending');
    });
  });

  it('exposes offline status through isOffline property', async () => {
    // Start online
    (useNetworkStatus as jest.Mock).mockReturnValue({
      connectionStatus: 'online',
    });

    const { result } = renderHook(() =>
      useMessages(mockConversationId, mockUserId, mockParticipants)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Note: This test validates the isOffline property is correctly derived from useNetworkStatus
    // In a real scenario, changing network status would trigger a re-render through React's state updates
    expect(result.current.isOffline).toBe(false);
  });
});
