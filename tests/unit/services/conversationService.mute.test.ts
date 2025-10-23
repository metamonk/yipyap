/**
 * Unit tests for conversation mute functionality
 */

import { muteConversation } from '@/services/conversationService';
import { updateDoc, getDoc } from 'firebase/firestore';
import type { Conversation } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn((db, ...pathSegments) => ({
    path: pathSegments.join('/'),
  })),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 })),
  Timestamp: {
    now: jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({
      _seconds: date.getTime() / 1000,
      _nanoseconds: 0,
    })),
  },
}));

// Mock Firebase service
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({
    _type: 'firestore',
  })),
}));

describe('Conversation Service - Mute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('muteConversation', () => {
    const conversationId = 'user1_user2';
    const userId = 'user1';
    const otherUserId = 'user2';

    const mockConversation: Conversation = {
      id: conversationId,
      type: 'direct',
      participantIds: [userId, otherUserId],
      lastMessage: {
        text: 'Hello',
        senderId: userId,
        timestamp: Timestamp.now(),
      },
      lastMessageTimestamp: Timestamp.now(),
      unreadCount: {},
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    it('should mute conversation successfully', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await muteConversation(conversationId, userId, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`mutedBy.${userId}`]: true,
        })
      );
    });

    it('should unmute conversation successfully', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockConversation,
          mutedBy: { [userId]: true },
        }),
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await muteConversation(conversationId, userId, false);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`mutedBy.${userId}`]: false,
        })
      );
    });

    it('should throw error when conversation does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(muteConversation(conversationId, userId, true)).rejects.toThrow(
        'Conversation not found'
      );
    });

    it('should throw error when user is not a participant', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockConversation,
          participantIds: [otherUserId, 'user3'],
        }),
      });

      await expect(muteConversation(conversationId, userId, true)).rejects.toThrow(
        'You must be a participant in this conversation'
      );
    });

    it('should handle invalid conversationId', async () => {
      (getDoc as jest.Mock).mockRejectedValueOnce({
        code: 'not-found',
      });

      await expect(muteConversation('invalid-id', userId, true)).rejects.toThrow();
    });

    it('should handle permission-denied error', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockRejectedValueOnce({
        code: 'permission-denied',
        message: 'Permission denied',
      });

      await expect(muteConversation(conversationId, userId, true)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should handle network errors', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(muteConversation(conversationId, userId, true)).rejects.toThrow(
        'Failed to update mute settings'
      );
    });

    it('should update with serverTimestamp', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await muteConversation(conversationId, userId, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          updatedAt: expect.anything(),
        })
      );
    });

    it('should allow multiple users to mute independently', async () => {
      const user2 = 'user2';

      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await muteConversation(conversationId, user2, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`mutedBy.${user2}`]: true,
        })
      );
    });

    it('should handle group conversations', async () => {
      const groupConversation: Conversation = {
        ...mockConversation,
        type: 'group',
        participantIds: [userId, otherUserId, 'user3'],
        groupName: 'Test Group',
      };

      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => groupConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await muteConversation(conversationId, userId, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`mutedBy.${userId}`]: true,
        })
      );
    });
  });
});
