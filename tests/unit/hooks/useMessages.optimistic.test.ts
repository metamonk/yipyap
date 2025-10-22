/**
 * Unit tests for useMessages hook - Optimistic UI
 *
 * @remarks
 * Tests optimistic UI updates for instant message display:
 * - Immediate message addition to optimistic state
 * - Temporary ID generation and replacement
 * - Status transitions (sending → delivered)
 * - Deduplication logic
 * - Failed message handling
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
import { useMessages } from '@/hooks/useMessages';
import type { Message } from '@/types/models';
import * as messageService from '@/services/messageService';
import * as conversationService from '@/services/conversationService';

// Mock services
jest.mock('@/services/messageService');
jest.mock('@/services/conversationService');

const mockSendMessage = messageService.sendMessage as jest.MockedFunction<
  typeof messageService.sendMessage
>;
const mockSubscribeToMessages = messageService.subscribeToMessages as jest.MockedFunction<
  typeof messageService.subscribeToMessages
>;
const mockUpdateConversationLastMessage =
  conversationService.updateConversationLastMessage as jest.MockedFunction<
    typeof conversationService.updateConversationLastMessage
  >;

describe('useMessages - Optimistic UI', () => {
  const conversationId = 'test-conv-123';
  const currentUserId = 'user-123';
  const participantIds = ['user-123', 'user-456'];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation for subscribeToMessages
    mockSubscribeToMessages.mockImplementation((convId, callback) => {
      // Call callback with empty array initially
      callback([]);
      // Return unsubscribe function
      return jest.fn();
    });

    // Default mock implementation for updateConversationLastMessage
    mockUpdateConversationLastMessage.mockResolvedValue(undefined);
  });

  describe('immediate optimistic update', () => {
    it('adds message to optimistic state immediately on send', async () => {
      // Mock successful send
      mockSendMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Delay to simulate network latency
            setTimeout(
              () =>
                resolve({
                  id: 'firestore-123',
                  conversationId,
                  senderId: currentUserId,
                  text: 'Test message',
                  status: 'delivered',
                  readBy: [currentUserId],
                  timestamp: Timestamp.now(),
                  metadata: { aiProcessed: false },
                }),
              100
            );
          })
      );

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialMessageCount = result.current.messages.length;

      // Send message
      await act(async () => {
        result.current.sendMessage('Test message');
        // Allow time for state update
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Message should appear immediately in optimistic state
      expect(result.current.messages.length).toBe(initialMessageCount + 1);
      const optimisticMsg = result.current.messages[result.current.messages.length - 1];
      expect(optimisticMsg.text).toBe('Test message');
      expect(optimisticMsg.status).toBe('sending');
      expect(optimisticMsg.id).toMatch(/^temp_/); // Temporary ID
    });

    it('displays optimistic message within 50ms of send', async () => {
      mockSendMessage.mockResolvedValue({
        id: 'firestore-123',
        conversationId,
        senderId: currentUserId,
        text: 'Fast message',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const startTime = Date.now();

      await act(async () => {
        result.current.sendMessage('Fast message');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const displayTime = Date.now() - startTime;

      // Verify message appears quickly
      expect(displayTime).toBeLessThan(50);
      expect(result.current.messages[result.current.messages.length - 1].text).toBe('Fast message');
    });
  });

  describe('temporary ID handling', () => {
    it('generates unique temporary IDs for multiple messages', async () => {
      mockSendMessage.mockImplementation(
        (input) =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  id: `firestore-${Date.now()}`,
                  conversationId,
                  senderId: currentUserId,
                  text: input.text,
                  status: 'delivered',
                  readBy: [currentUserId],
                  timestamp: Timestamp.now(),
                  metadata: { aiProcessed: false },
                }),
              100
            );
          })
      );

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send multiple messages rapidly
      await act(async () => {
        result.current.sendMessage('Message 1');
        result.current.sendMessage('Message 2');
        result.current.sendMessage('Message 3');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Get temporary IDs
      const tempIds = result.current.messages
        .filter((msg) => msg.id.startsWith('temp_'))
        .map((msg) => msg.id);

      // All IDs should be unique
      const uniqueIds = new Set(tempIds);
      expect(uniqueIds.size).toBe(tempIds.length);
    });

    it('replaces temp ID with Firestore ID on successful send', async () => {
      mockSendMessage.mockResolvedValue({
        id: 'firestore-confirmed',
        conversationId,
        senderId: currentUserId,
        text: 'Test message',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      // Wait for Firestore confirmation
      await waitFor(
        () => {
          const msgs = result.current.messages;
          return msgs.length === 0 || !msgs.some((m) => m.id.startsWith('temp_'));
        },
        { timeout: 2000 }
      );

      // Should no longer have temp IDs
      const hasTempIds = result.current.messages.some((msg) => msg.id.startsWith('temp_'));
      expect(hasTempIds).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('updates status from sending to delivered on success', async () => {
      let resolveMessage: (value: Message) => void;
      const messagePromise = new Promise((resolve) => {
        resolveMessage = resolve;
      });

      mockSendMessage.mockReturnValue(messagePromise as Promise<Message>);

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message
      await act(async () => {
        result.current.sendMessage('Test message');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should be in sending state
      let testMsg = result.current.messages.find((m) => m.text === 'Test message');
      expect(testMsg?.status).toBe('sending');

      // Resolve Firestore write
      await act(async () => {
        resolveMessage!({
          id: 'firestore-123',
          conversationId,
          senderId: currentUserId,
          text: 'Test message',
          status: 'delivered',
          readBy: [currentUserId],
          timestamp: Timestamp.now(),
          metadata: { aiProcessed: false },
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should be removed from optimistic state (deduplication will show confirmed message)
      await waitFor(() => {
        const tempMsgs = result.current.messages.filter((m) => m.id.startsWith('temp_'));
        return tempMsgs.length === 0;
      });
    });
  });

  describe('failed message handling', () => {
    it('updates status to failed on Firestore error', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.sendMessage('Failed message');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Message should remain with failed status
      const failedMsg = result.current.messages.find((m) => m.text === 'Failed message');
      expect(failedMsg).toBeDefined();
      expect(failedMsg?.status).toBe('failed');
      expect(failedMsg?.id).toMatch(/^temp_/); // Still has temp ID
    });

    it('keeps failed message in optimistic state for retry', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCount = result.current.messages.length;

      await act(async () => {
        await result.current.sendMessage('Failed message');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Failed message should still be in messages array
      expect(result.current.messages.length).toBe(initialCount + 1);
      const failedMsg = result.current.messages.find((m) => m.text === 'Failed message');
      expect(failedMsg).toBeDefined();
      expect(failedMsg?.status).toBe('failed');
    });
  });

  describe('deduplication logic', () => {
    it('prevents duplicate messages when real-time listener fires', async () => {
      let subscribeCallback: (messages: Message[]) => void;

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback([]); // Initial empty state
        return jest.fn();
      });

      mockSendMessage.mockResolvedValue({
        id: 'firestore-123',
        conversationId,
        senderId: currentUserId,
        text: 'Dedupe test',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message
      await act(async () => {
        await result.current.sendMessage('Dedupe test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const messageCountBeforeListener = result.current.messages.filter(
        (m) => m.text === 'Dedupe test'
      ).length;

      // Simulate real-time listener firing with the same message
      await act(async () => {
        subscribeCallback!([
          {
            id: 'firestore-123',
            conversationId,
            senderId: currentUserId,
            text: 'Dedupe test',
            status: 'delivered',
            readBy: [currentUserId],
            timestamp: Timestamp.now(),
            metadata: { aiProcessed: false },
          },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should not have duplicate messages
      const dedupeTestMessages = result.current.messages.filter((m) => m.text === 'Dedupe test');
      expect(dedupeTestMessages.length).toBeLessThanOrEqual(messageCountBeforeListener);
    });
  });

  describe('message merging and sorting', () => {
    it('merges optimistic and confirmed messages sorted by timestamp', async () => {
      const existingMessages = [
        {
          id: 'msg-1',
          conversationId,
          senderId: 'user-456',
          text: 'Existing message',
          status: 'delivered' as const,
          readBy: ['user-456', currentUserId],
          timestamp: Timestamp.fromMillis(Date.now() - 10000),
          metadata: { aiProcessed: false },
        },
      ];

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        callback(existingMessages);
        return jest.fn();
      });

      mockSendMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  id: 'firestore-new',
                  conversationId,
                  senderId: currentUserId,
                  text: 'New message',
                  status: 'delivered',
                  readBy: [currentUserId],
                  timestamp: Timestamp.now(),
                  metadata: { aiProcessed: false },
                }),
              100
            );
          })
      );

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send new message
      await act(async () => {
        result.current.sendMessage('New message');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should have both messages sorted by timestamp
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);

      // Existing message should come first (older timestamp)
      expect(result.current.messages[0].text).toBe('Existing message');

      // New message should come last (newer timestamp)
      const lastMsg = result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.text).toBe('New message');
    });
  });
});
