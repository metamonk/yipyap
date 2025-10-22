/**
 * Unit tests for useMessages hook - Retry Functionality
 *
 * @remarks
 * Tests retry logic for failed messages:
 * - Retry message function
 * - Status transitions during retry (failed → sending → delivered/failed)
 * - Successful retry handling
 * - Failed retry handling
 * - Edge cases (missing message, multiple retries)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { useMessages } from '@/hooks/useMessages';
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

describe('useMessages - Retry Functionality', () => {
  const conversationId = 'test-conv-123';
  const currentUserId = 'user-123';
  const participantIds = ['user-123', 'user-456'];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation for subscribeToMessages
    mockSubscribeToMessages.mockImplementation((convId, callback) => {
      callback([]);
      return jest.fn();
    });

    // Default mock implementation for updateConversationLastMessage
    mockUpdateConversationLastMessage.mockResolvedValue(undefined);
  });

  describe('retry message function', () => {
    it('retries sending a failed message', async () => {
      // First send fails
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify message failed
      const failedMsg = result.current.messages.find((m) => m.text === 'Retry test');
      expect(failedMsg?.status).toBe('failed');
      const failedMsgId = failedMsg!.id;

      // Mock successful retry
      mockSendMessage.mockResolvedValueOnce({
        id: 'firestore-retry-success',
        conversationId,
        senderId: currentUserId,
        text: 'Retry test',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      // Retry message
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify sendMessage was called again
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it('updates status to sending during retry', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Retry test');
      const failedMsgId = failedMsg!.id;

      // Mock delayed successful retry
      mockSendMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  id: 'firestore-retry-success',
                  conversationId,
                  senderId: currentUserId,
                  text: 'Retry test',
                  status: 'delivered',
                  readBy: [currentUserId],
                  timestamp: Timestamp.now(),
                  metadata: { aiProcessed: false },
                }),
              100
            );
          })
      );

      // Start retry
      await act(async () => {
        result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      // Should be in sending state during retry
      const retryingMsg = result.current.messages.find((m) => m.id === failedMsgId);
      expect(retryingMsg?.status).toBe('sending');
    });
  });

  describe('successful retry', () => {
    it('removes message from optimistic state on successful retry', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry success test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Retry success test');
      const failedMsgId = failedMsg!.id;

      // Mock successful retry
      mockSendMessage.mockResolvedValueOnce({
        id: 'firestore-success',
        conversationId,
        senderId: currentUserId,
        text: 'Retry success test',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      // Retry message
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Optimistic message should be removed
      await waitFor(() => {
        const stillHasTempId = result.current.messages.some((m) => m.id === failedMsgId);
        return !stillHasTempId;
      });

      const tempMsg = result.current.messages.find((m) => m.id === failedMsgId);
      expect(tempMsg).toBeUndefined();
    });

    it('updates conversation lastMessage on successful retry', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry success test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Retry success test');
      const failedMsgId = failedMsg!.id;

      const confirmedTimestamp = Timestamp.now();

      // Mock successful retry
      mockSendMessage.mockResolvedValueOnce({
        id: 'firestore-success',
        conversationId,
        senderId: currentUserId,
        text: 'Retry success test',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: confirmedTimestamp,
        metadata: { aiProcessed: false },
      });

      // Retry message
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify updateConversationLastMessage was called
      expect(mockUpdateConversationLastMessage).toHaveBeenCalledWith(
        conversationId,
        {
          text: 'Retry success test',
          senderId: currentUserId,
          timestamp: confirmedTimestamp,
        },
        participantIds,
        currentUserId
      );
    });
  });

  describe('failed retry', () => {
    it('updates status back to failed on retry failure', async () => {
      // Both send and retry fail
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry fail test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Retry fail test');
      const failedMsgId = failedMsg!.id;

      // Retry message (will also fail)
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should be back to failed status
      const stillFailedMsg = result.current.messages.find((m) => m.id === failedMsgId);
      expect(stillFailedMsg?.status).toBe('failed');
    });

    it('displays alert on retry failure', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry fail test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Retry fail test');
      const failedMsgId = failedMsg!.id;

      // Clear previous alert calls
      (Alert.alert as jest.Mock).mockClear();

      // Retry message (will fail)
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify alert was shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Failed to send message',
        'Please check your connection and try again.'
      );
    });

    it('keeps message in messages array after retry failure', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Retry fail test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Retry fail test');
      const failedMsgId = failedMsg!.id;
      const messageCountBeforeRetry = result.current.messages.length;

      // Retry message (will fail)
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Message should still be in array
      expect(result.current.messages.length).toBe(messageCountBeforeRetry);
      const stillExistsMsg = result.current.messages.find((m) => m.id === failedMsgId);
      expect(stillExistsMsg).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles retry of non-existent message gracefully', async () => {
      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Try to retry non-existent message
      await act(async () => {
        await result.current.retryMessage('non-existent-id');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should not throw error or call sendMessage
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('handles multiple retry attempts on same message', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage('Multiple retry test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === 'Multiple retry test');
      const failedMsgId = failedMsg!.id;

      // First retry (will fail)
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(2);

      // Second retry (will fail)
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(3);

      // Mock success for third retry
      mockSendMessage.mockResolvedValueOnce({
        id: 'firestore-finally-success',
        conversationId,
        senderId: currentUserId,
        text: 'Multiple retry test',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      // Third retry (will succeed)
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(4);

      // Should be removed from optimistic state on success
      await waitFor(() => {
        const tempMsg = result.current.messages.find((m) => m.id === failedMsgId);
        return !tempMsg;
      });
    });

    it('retries with original message text', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalText = 'Original message text';

      // Send message (will fail)
      await act(async () => {
        await result.current.sendMessage(originalText);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const failedMsg = result.current.messages.find((m) => m.text === originalText);
      const failedMsgId = failedMsg!.id;

      // Mock successful retry
      mockSendMessage.mockResolvedValueOnce({
        id: 'firestore-success',
        conversationId,
        senderId: currentUserId,
        text: originalText,
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      // Retry message
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify sendMessage was called with original text
      expect(mockSendMessage).toHaveBeenLastCalledWith(
        {
          conversationId,
          senderId: currentUserId,
          text: originalText,
        },
        participantIds
      );
    });
  });
});
