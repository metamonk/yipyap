/**
 * Unit tests for conversation archive functionality
 */

import {
  archiveConversation,
  subscribeToArchivedConversations,
  subscribeToConversations,
} from '@/services/conversationService';
import { updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import type { Conversation } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn((db, ...pathSegments) => ({
    path: pathSegments.join('/'),
  })),
  collection: jest.fn((db, collectionName) => ({
    path: collectionName,
  })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  onSnapshot: jest.fn(),
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

describe('Conversation Service - Archive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('archiveConversation', () => {
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

    it('should archive conversation successfully', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await archiveConversation(conversationId, userId, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`archivedBy.${userId}`]: true,
        })
      );
    });

    it('should unarchive conversation successfully', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          ...mockConversation,
          archivedBy: { [userId]: true },
        }),
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await archiveConversation(conversationId, userId, false);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`archivedBy.${userId}`]: false,
        })
      );
    });

    it('should throw error when conversation does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(archiveConversation(conversationId, userId, true)).rejects.toThrow(
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

      await expect(archiveConversation(conversationId, userId, true)).rejects.toThrow(
        'You must be a participant in this conversation'
      );
    });

    it('should handle invalid conversationId', async () => {
      (getDoc as jest.Mock).mockRejectedValueOnce({
        code: 'not-found',
      });

      await expect(archiveConversation('invalid-id', userId, true)).rejects.toThrow();
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

      await expect(archiveConversation(conversationId, userId, true)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should handle network errors', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(archiveConversation(conversationId, userId, true)).rejects.toThrow(
        'Failed to update archive settings'
      );
    });

    it('should update with serverTimestamp', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await archiveConversation(conversationId, userId, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          updatedAt: expect.anything(),
        })
      );
    });

    it('should allow multiple users to archive independently', async () => {
      const user2 = 'user2';

      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConversation,
      });
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await archiveConversation(conversationId, user2, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`archivedBy.${user2}`]: true,
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

      await archiveConversation(conversationId, userId, true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `conversations/${conversationId}` }),
        expect.objectContaining({
          [`archivedBy.${userId}`]: true,
        })
      );
    });
  });

  describe('subscribeToArchivedConversations', () => {
    const userId = 'user1';
    const mockCallback = jest.fn();

    const mockArchivedConversation: Conversation = {
      id: 'conv1',
      type: 'direct',
      participantIds: [userId, 'user2'],
      lastMessage: {
        text: 'Hello',
        senderId: userId,
        timestamp: Timestamp.now(),
      },
      lastMessageTimestamp: Timestamp.now(),
      unreadCount: {},
      archivedBy: { [userId]: true },
      deletedBy: {},
      mutedBy: {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const mockNonArchivedConversation: Conversation = {
      ...mockArchivedConversation,
      id: 'conv2',
      archivedBy: {},
    };

    const mockDeletedArchivedConversation: Conversation = {
      ...mockArchivedConversation,
      id: 'conv3',
      archivedBy: { [userId]: true },
      deletedBy: { [userId]: true },
    };

    it('should return only archived conversations', () => {
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementationOnce((q, successCallback) => {
        const mockSnapshot = {
          forEach: (callback: (doc: any) => void) => {
            callback({ data: () => mockArchivedConversation });
            callback({ data: () => mockNonArchivedConversation });
          },
        };
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      const unsubscribe = subscribeToArchivedConversations(userId, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([mockArchivedConversation]);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should exclude deleted conversations', () => {
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementationOnce((q, successCallback) => {
        const mockSnapshot = {
          forEach: (callback: (doc: any) => void) => {
            callback({ data: () => mockArchivedConversation });
            callback({ data: () => mockDeletedArchivedConversation });
          },
        };
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToArchivedConversations(userId, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([mockArchivedConversation]);
    });

    it('should handle empty results', () => {
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementationOnce((q, successCallback) => {
        const mockSnapshot = {
          forEach: () => {},
        };
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToArchivedConversations(userId, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([]);
    });

    it('should handle subscription errors gracefully', () => {
      (onSnapshot as jest.Mock).mockImplementationOnce((q, successCallback, errorCallback) => {
        errorCallback(new Error('Subscription error'));
        return jest.fn();
      });

      subscribeToArchivedConversations(userId, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([]);
    });
  });

  describe('subscribeToConversations - archive filtering', () => {
    const userId = 'user1';
    const mockCallback = jest.fn();

    const mockActiveConversation: Conversation = {
      id: 'conv1',
      type: 'direct',
      participantIds: [userId, 'user2'],
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

    const mockArchivedConversation: Conversation = {
      ...mockActiveConversation,
      id: 'conv2',
      archivedBy: { [userId]: true },
    };

    it('should filter out archived conversations', () => {
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementationOnce((q, successCallback) => {
        const mockSnapshot = {
          forEach: (callback: (doc: any) => void) => {
            callback({ data: () => mockActiveConversation });
            callback({ data: () => mockArchivedConversation });
          },
        };
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToConversations(userId, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([mockActiveConversation]);
    });

    it('should include conversation archived by other users', () => {
      const conversationArchivedByOther: Conversation = {
        ...mockActiveConversation,
        id: 'conv3',
        archivedBy: { user2: true },
      };

      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementationOnce((q, successCallback) => {
        const mockSnapshot = {
          forEach: (callback: (doc: any) => void) => {
            callback({ data: () => mockActiveConversation });
            callback({ data: () => conversationArchivedByOther });
          },
        };
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToConversations(userId, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([
        mockActiveConversation,
        conversationArchivedByOther,
      ]);
    });
  });
});
