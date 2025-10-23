/**
 * Unit tests for useMessages hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
import { useMessages } from '@/hooks/useMessages';
import * as messageService from '@/services/messageService';
import type { Message } from '@/types/models';

// Mock the message service
jest.mock('@/services/messageService');

const mockedSubscribeToMessages = messageService.subscribeToMessages as jest.MockedFunction<
  typeof messageService.subscribeToMessages
>;
const mockedSendMessage = messageService.sendMessage as jest.MockedFunction<
  typeof messageService.sendMessage
>;

// Create mock Timestamp helper
const createMockTimestamp = (millis: number): Timestamp =>
  ({
    toDate: () => new Date(millis),
    toMillis: () => millis,
    seconds: Math.floor(millis / 1000),
    nanoseconds: (millis % 1000) * 1000000,
    isEqual: jest.fn(),
    valueOf: jest.fn(),
     
  }) as any;

describe('useMessages', () => {
  const conversationId = 'conv123';
  const currentUserId = 'user123';
  const participantIds = ['user123', 'user456'];

  const mockMessages: Message[] = [
    {
      id: 'msg1',
      conversationId,
      senderId: 'user123',
      text: 'Hello',
      status: 'delivered',
      readBy: ['user123'],
      timestamp: createMockTimestamp(1000000),
      metadata: { aiProcessed: false },
    },
    {
      id: 'msg2',
      conversationId,
      senderId: 'user456',
      text: 'Hi there',
      status: 'delivered',
      readBy: ['user123', 'user456'],
      timestamp: createMockTimestamp(2000000),
      metadata: { aiProcessed: false },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Subscription', () => {
    it('subscribes to messages on mount', () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);

      renderHook(() => useMessages(conversationId, currentUserId, participantIds));

      expect(mockedSubscribeToMessages).toHaveBeenCalledWith(
        conversationId,
        expect.any(Function),
        50
      );
    });

    it('unsubscribes on unmount', () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('does not subscribe when conversationId is empty', () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);

      renderHook(() => useMessages('', currentUserId, participantIds));

      expect(mockedSubscribeToMessages).not.toHaveBeenCalled();
    });
  });

  describe('Message Updates', () => {
    it('updates messages when subscription callback is triggered', async () => {
      let callback: (messages: Message[]) => void = () => {};

      mockedSubscribeToMessages.mockImplementation((_, cb) => {
        callback = cb;
        return jest.fn();
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.messages).toEqual([]);

      // Trigger callback with messages
      act(() => {
        callback(mockMessages);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Messages should be sorted by timestamp (ascending)
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe('msg1');
      expect(result.current.messages[1].id).toBe('msg2');
    });

    it('sorts messages by timestamp ascending', async () => {
      let callback: (messages: Message[]) => void = () => {};

      mockedSubscribeToMessages.mockImplementation((_, cb) => {
        callback = cb;
        return jest.fn();
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      // Send messages in reverse order
      const reversedMessages = [...mockMessages].reverse();

      act(() => {
        callback(reversedMessages);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still be sorted correctly
      expect(result.current.messages[0].id).toBe('msg1');
      expect(result.current.messages[1].id).toBe('msg2');
    });
  });

  describe('Send Message', () => {
    it('calls sendMessage service with correct parameters', async () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);
      mockedSendMessage.mockResolvedValue({
        id: 'msg3',
        conversationId,
        senderId: currentUserId,
        text: 'New message',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: createMockTimestamp(Date.now()),
        metadata: { aiProcessed: false },
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await act(async () => {
        await result.current.sendMessage('New message');
      });

      expect(mockedSendMessage).toHaveBeenCalledWith(
        {
          conversationId,
          senderId: currentUserId,
          text: 'New message',
        },
        participantIds
      );
    });

    it('throws error when sendMessage fails', async () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);
      const error = new Error('Network error');
      mockedSendMessage.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await expect(
        act(async () => {
          await result.current.sendMessage('New message');
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('FlatList Ref', () => {
    it('provides flatListRef for scroll control', () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      expect(result.current.flatListRef).toBeDefined();
      expect(result.current.flatListRef.current).toBeNull();
    });

    it('provides scrollToBottom function', () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      expect(result.current.scrollToBottom).toBeDefined();
      expect(typeof result.current.scrollToBottom).toBe('function');
    });
  });

  describe('Auto-scroll', () => {
    it('calls scrollToBottom after initial load', async () => {
      let callback: (messages: Message[]) => void = () => {};

      mockedSubscribeToMessages.mockImplementation((_, cb) => {
        callback = cb;
        return jest.fn();
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      // Mock the flatListRef
      const mockScrollToEnd = jest.fn();
      result.current.flatListRef.current = {
        scrollToEnd: mockScrollToEnd,
         
      } as any;

      // Trigger callback with messages
      act(() => {
        callback(mockMessages);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Fast-forward timers for the scrollToBottom setTimeout
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
      });
    });

    it('calls scrollToBottom after sending message', async () => {
      let callback: (messages: Message[]) => void = () => {};

      mockedSubscribeToMessages.mockImplementation((_, cb) => {
        callback = cb;
        return jest.fn();
      });

      mockedSendMessage.mockResolvedValue({
        id: 'msg3',
        conversationId,
        senderId: currentUserId,
        text: 'New message',
        status: 'delivered',
        readBy: [currentUserId],
        timestamp: createMockTimestamp(Date.now()),
        metadata: { aiProcessed: false },
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      // Set up initial messages
      act(() => {
        callback(mockMessages);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock the flatListRef
      const mockScrollToEnd = jest.fn();
      result.current.flatListRef.current = {
        scrollToEnd: mockScrollToEnd,
         
      } as any;

      // Clear previous calls
      mockScrollToEnd.mockClear();

      await act(async () => {
        await result.current.sendMessage('New message');
      });

      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(mockScrollToEnd).toHaveBeenCalled();
      });
    });
  });

  describe('Loading State', () => {
    it('starts with loading true', () => {
      const unsubscribe = jest.fn();
      mockedSubscribeToMessages.mockReturnValue(unsubscribe);

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      expect(result.current.loading).toBe(true);
    });

    it('sets loading false after initial messages load', async () => {
      let callback: (messages: Message[]) => void = () => {};

      mockedSubscribeToMessages.mockImplementation((_, cb) => {
        callback = cb;
        return jest.fn();
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      act(() => {
        callback(mockMessages);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
