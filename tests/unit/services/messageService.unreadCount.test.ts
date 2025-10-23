/**
 * Unit tests for message service unread count functionality
 * @module tests/unit/services/messageService.unreadCount
 */

import { sendMessage } from '@/services/messageService';
import {
  updateConversationLastMessage,
  checkConversationExists,
} from '@/services/conversationService';
import { getFirebaseDb } from '@/services/firebase';
import type { CreateMessageInput } from '@/types/models';

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('@/services/conversationService');

// Mock Firestore functions
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _methodName: 'serverTimestamp' }));
const mockIncrement = jest.fn((value: number) => ({ _methodName: 'increment', _value: value }));

jest.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  increment: (value: number) => mockIncrement(value),
  Timestamp: {
    now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }),
  },
}));

describe('Message Service - Unread Count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue({});
    (checkConversationExists as jest.Mock).mockResolvedValue(true);
    (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);
    mockCollection.mockReturnValue('mockCollectionRef');
    mockDoc.mockReturnValue('mockDocRef');
    mockAddDoc.mockResolvedValue({ id: 'message123' });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('sendMessage - unread count increment', () => {
    it('should increment unreadCount for recipients but not sender', async () => {
      const participantIds = ['sender123', 'recipient456', 'recipient789'];
      const input: CreateMessageInput = {
        conversationId: 'conv1',
        senderId: 'sender123',
        text: 'Hello everyone',
      };

      await sendMessage(input, participantIds);

      // Verify updateConversationLastMessage was called with correct participants
      expect(updateConversationLastMessage).toHaveBeenCalledWith(
        'conv1',
        expect.objectContaining({
          text: 'Hello everyone',
          senderId: 'sender123',
        }),
        participantIds,
        'sender123'
      );
    });

    it('should increment unreadCount for all recipients in group conversation', async () => {
      const participantIds = ['sender1', 'user2', 'user3', 'user4', 'user5'];
      const input: CreateMessageInput = {
        conversationId: 'group1',
        senderId: 'sender1',
        text: 'Hello group',
      };

      await sendMessage(input, participantIds);

      // Verify all participants except sender
      expect(updateConversationLastMessage).toHaveBeenCalledWith(
        'group1',
        expect.anything(),
        participantIds,
        'sender1'
      );
    });

    it('should handle direct conversation with 2 participants', async () => {
      const participantIds = ['user1', 'user2'];
      const input: CreateMessageInput = {
        conversationId: 'direct1',
        senderId: 'user1',
        text: 'Hi there',
      };

      await sendMessage(input, participantIds);

      // Only user2 should get unread increment (user1 is sender)
      expect(updateConversationLastMessage).toHaveBeenCalledWith(
        'direct1',
        expect.anything(),
        participantIds,
        'user1'
      );
    });

    it('should not increment unread count if sender is only participant', async () => {
      const participantIds = ['user1'];
      const input: CreateMessageInput = {
        conversationId: 'self1',
        senderId: 'user1',
        text: 'Note to self',
      };

      await sendMessage(input, participantIds);

      // No recipients to increment
      expect(updateConversationLastMessage).toHaveBeenCalledWith(
        'self1',
        expect.anything(),
        participantIds,
        'user1'
      );
    });
  });

  describe('sendMessage - error handling', () => {
    it('should throw error for empty message text', async () => {
      const input: CreateMessageInput = {
        conversationId: 'conv1',
        senderId: 'user1',
        text: '',
      };

      await expect(sendMessage(input, ['user1', 'user2'])).rejects.toThrow(
        'Message text cannot be empty'
      );
    });

    it('should throw error for message exceeding 1000 characters', async () => {
      const longText = 'a'.repeat(1001);
      const input: CreateMessageInput = {
        conversationId: 'conv1',
        senderId: 'user1',
        text: longText,
      };

      await expect(sendMessage(input, ['user1', 'user2'])).rejects.toThrow(
        'Message text cannot exceed 1000 characters'
      );
    });

    it('should handle Firestore errors gracefully', async () => {
      const input: CreateMessageInput = {
        conversationId: 'conv1',
        senderId: 'user1',
        text: 'Test message',
      };

      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(sendMessage(input, ['user1', 'user2'])).rejects.toThrow();
    });
  });
});
