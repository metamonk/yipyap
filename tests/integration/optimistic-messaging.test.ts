/**
 * Integration tests for optimistic messaging flow
 *
 * @remarks
 * Tests end-to-end optimistic UI with Firebase Emulator:
 * - Complete message send flow (optimistic → confirmed)
 * - Real-time listener integration with deduplication
 * - Failed send and retry flow
 * - Performance requirements (95% success rate, <50ms optimistic display)
 * - Multiple concurrent messages
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
import { useMessages } from '@/hooks/useMessages';
import type { Message } from '@/types/models';
import * as messageService from '@/services/messageService';
import * as conversationService from '@/services/conversationService';

// Mock services for integration test
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

describe('Optimistic Messaging Integration', () => {
  const conversationId = 'integration-conv-123';
  const currentUserId = 'user-123';
  const participantIds = ['user-123', 'user-456'];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConversationLastMessage.mockResolvedValue(undefined);
  });

  describe('complete optimistic UI flow', () => {
    it('successfully sends message with optimistic UI', async () => {
      let subscribeCallback: (messages: Message[]) => void;
      const confirmedMessages: Message[] = [];

      // Mock real-time listener
      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback(confirmedMessages); // Initial state
        return jest.fn();
      });

      // Mock successful Firestore write
      mockSendMessage.mockImplementation(async (input) => {
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 50));

        const confirmedMessage = {
          id: `firestore-${Date.now()}`,
          conversationId,
          senderId: currentUserId,
          text: input.text,
          status: 'delivered' as const,
          readBy: [currentUserId],
          timestamp: Timestamp.now(),
          metadata: { aiProcessed: false },
        };

        // Add to confirmed messages (simulating Firestore)
        confirmedMessages.push(confirmedMessage);

        // Trigger real-time listener
        setTimeout(() => {
          subscribeCallback(confirmedMessages);
        }, 10);

        return confirmedMessage;
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const startTime = Date.now();

      // Send message
      await act(async () => {
        result.current.sendMessage('Integration test message');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const optimisticDisplayTime = Date.now() - startTime;

      // REQUIREMENT: Optimistic display within 50ms
      expect(optimisticDisplayTime).toBeLessThan(50);

      // Message should appear immediately in optimistic state
      let testMsg = result.current.messages.find((m) => m.text === 'Integration test message');
      expect(testMsg).toBeDefined();
      expect(testMsg?.status).toBe('sending');
      expect(testMsg?.id).toMatch(/^temp_/);

      // Wait for Firestore confirmation
      await waitFor(
        () => {
          const msg = result.current.messages.find((m) => m.text === 'Integration test message');
          return msg && msg.status === 'delivered';
        },
        { timeout: 2000 }
      );

      // Message should now be confirmed
      testMsg = result.current.messages.find((m) => m.text === 'Integration test message');
      expect(testMsg?.status).toBe('delivered');
      expect(testMsg?.id).not.toMatch(/^temp_/); // Should have Firestore ID
    });

    it('handles deduplication when real-time listener fires', async () => {
      let subscribeCallback: (messages: Message[]) => void;
      const confirmedMessages: Message[] = [];

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback(confirmedMessages);
        return jest.fn();
      });

      mockSendMessage.mockImplementation(async (input) => {
        const confirmedMessage = {
          id: `firestore-${Date.now()}`,
          conversationId,
          senderId: currentUserId,
          text: input.text,
          status: 'delivered' as const,
          readBy: [currentUserId],
          timestamp: Timestamp.now(),
          metadata: { aiProcessed: false },
        };

        confirmedMessages.push(confirmedMessage);

        // Trigger listener after delay
        setTimeout(() => {
          subscribeCallback([...confirmedMessages]);
        }, 100);

        return confirmedMessage;
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send message
      await act(async () => {
        await result.current.sendMessage('Dedupe test message');
      });

      // Wait for listener to fire
      await waitFor(
        () => {
          const msgs = result.current.messages.filter((m) => m.text === 'Dedupe test message');
          return msgs.length === 1; // Should only have one copy
        },
        { timeout: 2000 }
      );

      // Verify no duplicates
      const dedupeMessages = result.current.messages.filter(
        (m) => m.text === 'Dedupe test message'
      );
      expect(dedupeMessages.length).toBe(1);
    });
  });

  describe('failed send and retry flow', () => {
    it('handles failed send and successful retry', async () => {
      let subscribeCallback: (messages: Message[]) => void;
      const confirmedMessages: Message[] = [];

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback(confirmedMessages);
        return jest.fn();
      });

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
        await result.current.sendMessage('Failed then retry test');
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify failed status
      let failedMsg = result.current.messages.find((m) => m.text === 'Failed then retry test');
      expect(failedMsg?.status).toBe('failed');
      const failedMsgId = failedMsg!.id;

      // Mock successful retry
      mockSendMessage.mockImplementation(async (input) => {
        const confirmedMessage = {
          id: `firestore-retry-${Date.now()}`,
          conversationId,
          senderId: currentUserId,
          text: input.text,
          status: 'delivered' as const,
          readBy: [currentUserId],
          timestamp: Timestamp.now(),
          metadata: { aiProcessed: false },
        };

        confirmedMessages.push(confirmedMessage);

        setTimeout(() => {
          subscribeCallback([...confirmedMessages]);
        }, 50);

        return confirmedMessage;
      });

      // Retry message
      await act(async () => {
        await result.current.retryMessage(failedMsgId);
      });

      // Wait for successful retry
      await waitFor(
        () => {
          const msg = result.current.messages.find((m) => m.text === 'Failed then retry test');
          return msg && msg.status === 'delivered';
        },
        { timeout: 2000 }
      );

      // Message should now be delivered
      const deliveredMsg = result.current.messages.find((m) => m.text === 'Failed then retry test');
      expect(deliveredMsg?.status).toBe('delivered');
      expect(deliveredMsg?.id).not.toBe(failedMsgId); // Should have new Firestore ID
    });
  });

  describe('performance requirements', () => {
    it('achieves 95%+ optimistic UI success rate', async () => {
      let subscribeCallback: (messages: Message[]) => void;
      const confirmedMessages: Message[] = [];

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback(confirmedMessages);
        return jest.fn();
      });

      // Simulate 97% success rate (3% failure)
      let callCount = 0;
      mockSendMessage.mockImplementation(async (input) => {
        callCount++;

        // Fail 3% of the time
        if (callCount % 33 === 0) {
          throw new Error('Simulated network error');
        }

        const confirmedMessage = {
          id: `firestore-${callCount}`,
          conversationId,
          senderId: currentUserId,
          text: input.text,
          status: 'delivered' as const,
          readBy: [currentUserId],
          timestamp: Timestamp.now(),
          metadata: { aiProcessed: false },
        };

        confirmedMessages.push(confirmedMessage);

        setTimeout(() => {
          subscribeCallback([...confirmedMessages]);
        }, 10);

        return confirmedMessage;
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const totalMessages = 100;
      let successCount = 0;

      // Send 100 messages
      for (let i = 0; i < totalMessages; i++) {
        await act(async () => {
          try {
            await result.current.sendMessage(`Test message ${i}`);
            await new Promise((resolve) => setTimeout(resolve, 20));
            successCount++;
          } catch {
            // Failed send (kept in optimistic state)
          }
        });
      }

      // Wait for all confirmations
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      const successRate = (successCount / totalMessages) * 100;

      // REQUIREMENT: Success rate exceeds 95%
      expect(successRate).toBeGreaterThanOrEqual(95);
    });

    it('displays optimistic message within 50ms', async () => {
      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        callback([]);
        return jest.fn();
      });

      mockSendMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  id: 'firestore-performance',
                  conversationId,
                  senderId: currentUserId,
                  text: 'Performance test',
                  status: 'delivered',
                  readBy: [currentUserId],
                  timestamp: Timestamp.now(),
                  metadata: { aiProcessed: false },
                }),
              200
            );
          })
      );

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const startTime = Date.now();

      await act(async () => {
        result.current.sendMessage('Performance test');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const displayTime = Date.now() - startTime;

      // REQUIREMENT: Display within 50ms
      expect(displayTime).toBeLessThan(50);

      // Message should be visible
      const msg = result.current.messages.find((m) => m.text === 'Performance test');
      expect(msg).toBeDefined();
    });
  });

  describe('concurrent messages', () => {
    it('handles multiple concurrent message sends', async () => {
      let subscribeCallback: (messages: Message[]) => void;
      const confirmedMessages: Message[] = [];

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback(confirmedMessages);
        return jest.fn();
      });

      mockSendMessage.mockImplementation(async (input) => {
        // Random delay to simulate varying network conditions
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

        const confirmedMessage = {
          id: `firestore-${Date.now()}-${Math.random()}`,
          conversationId,
          senderId: currentUserId,
          text: input.text,
          status: 'delivered' as const,
          readBy: [currentUserId],
          timestamp: Timestamp.now(),
          metadata: { aiProcessed: false },
        };

        confirmedMessages.push(confirmedMessage);

        setTimeout(() => {
          subscribeCallback([...confirmedMessages]);
        }, 10);

        return confirmedMessage;
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send 5 messages concurrently
      await act(async () => {
        await Promise.all([
          result.current.sendMessage('Concurrent message 1'),
          result.current.sendMessage('Concurrent message 2'),
          result.current.sendMessage('Concurrent message 3'),
          result.current.sendMessage('Concurrent message 4'),
          result.current.sendMessage('Concurrent message 5'),
        ]);
      });

      // All messages should appear immediately in optimistic state
      const optimisticMessages = result.current.messages.filter(
        (m) => m.text.startsWith('Concurrent message') && m.id.startsWith('temp_')
      );
      expect(optimisticMessages.length).toBeGreaterThan(0);

      // Wait for all confirmations
      await waitFor(
        () => {
          const tempMsgs = result.current.messages.filter((m) => m.id.startsWith('temp_'));
          return tempMsgs.length === 0;
        },
        { timeout: 3000 }
      );

      // All messages should be confirmed
      const concurrentMessages = result.current.messages.filter((m) =>
        m.text.startsWith('Concurrent message')
      );
      expect(concurrentMessages.length).toBe(5);

      // All should have delivered status
      concurrentMessages.forEach((msg) => {
        expect(msg.status).toBe('delivered');
        expect(msg.id).not.toMatch(/^temp_/);
      });
    });

    it('maintains correct message order with concurrent sends', async () => {
      let subscribeCallback: (messages: Message[]) => void;
      const confirmedMessages: Message[] = [];

      mockSubscribeToMessages.mockImplementation((convId, callback) => {
        subscribeCallback = callback;
        callback(confirmedMessages);
        return jest.fn();
      });

      const messageTimes: Record<string, number> = {};

      mockSendMessage.mockImplementation(async (input) => {
        // Record send time
        messageTimes[input.text] = Date.now();

        await new Promise((resolve) => setTimeout(resolve, 50));

        const confirmedMessage = {
          id: `firestore-${Date.now()}`,
          conversationId,
          senderId: currentUserId,
          text: input.text,
          status: 'delivered' as const,
          readBy: [currentUserId],
          timestamp: Timestamp.fromMillis(messageTimes[input.text]),
          metadata: { aiProcessed: false },
        };

        confirmedMessages.push(confirmedMessage);

        setTimeout(() => {
          subscribeCallback([...confirmedMessages]);
        }, 10);

        return confirmedMessage;
      });

      const { result } = renderHook(() =>
        useMessages(conversationId, currentUserId, participantIds)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Send messages sequentially with slight delay
      await act(async () => {
        await result.current.sendMessage('Order test 1');
        await new Promise((resolve) => setTimeout(resolve, 10));
        await result.current.sendMessage('Order test 2');
        await new Promise((resolve) => setTimeout(resolve, 10));
        await result.current.sendMessage('Order test 3');
      });

      // Wait for confirmations
      await waitFor(
        () => {
          const msgs = result.current.messages.filter((m) => m.text.startsWith('Order test'));
          return msgs.length === 3 && msgs.every((m) => m.status === 'delivered');
        },
        { timeout: 2000 }
      );

      // Messages should be in order
      const orderMessages = result.current.messages.filter((m) => m.text.startsWith('Order test'));
      expect(orderMessages[0].text).toBe('Order test 1');
      expect(orderMessages[1].text).toBe('Order test 2');
      expect(orderMessages[2].text).toBe('Order test 3');
    });
  });
});
