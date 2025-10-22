/**
 * Unit tests for conversationService
 * @remarks
 * Tests conversation ID generation, CRUD operations, querying,
 * and error handling scenarios
 */

import {
  generateConversationId,
  createConversation,
  getConversation,
  getUserConversations,
  updateConversationLastMessage,
  markConversationAsRead,
} from '@/services/conversationService';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  increment: jest.fn((value) => ({ _methodName: 'increment', _operand: value })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

describe('conversationService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = {} as any;
  const mockUser1 = 'user123';
  const mockUser2 = 'user456';
  const mockUser3 = 'user789';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
  });

  describe('generateConversationId', () => {
    it('should generate deterministic ID for 1:1 chat', () => {
      const id1 = generateConversationId([mockUser1, mockUser2]);
      const id2 = generateConversationId([mockUser2, mockUser1]); // Reversed order

      expect(id1).toBe('user123_user456');
      expect(id2).toBe('user123_user456'); // Should be the same
      expect(id1).toBe(id2);
    });

    it('should sort participant IDs alphabetically', () => {
      const id = generateConversationId(['userB', 'userA']);
      expect(id).toBe('userA_userB');
    });

    it('should throw error if not exactly 2 participants', () => {
      expect(() => generateConversationId([mockUser1])).toThrow(
        'Direct conversation requires exactly 2 participants'
      );

      expect(() => generateConversationId([mockUser1, mockUser2, mockUser3])).toThrow(
        'Direct conversation requires exactly 2 participants'
      );
    });
  });

  describe('createConversation', () => {
    it('should create a direct conversation with valid data', async () => {
      const mockDocRef = { id: 'user123_user456' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await createConversation({
        type: 'direct',
        participantIds: [mockUser1, mockUser2],
      });

      expect(result.id).toBe('user123_user456');
      expect(result.type).toBe('direct');
      expect(result.participantIds).toEqual([mockUser1, mockUser2]);
      expect(setDoc).toHaveBeenCalled();
    });

    it('should return existing direct conversation if already exists', async () => {
      const existingConversation = {
        id: 'user123_user456',
        type: 'direct',
        participantIds: [mockUser1, mockUser2],
        lastMessage: { text: 'Hello', senderId: mockUser1, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => existingConversation,
      });

      const result = await createConversation({
        type: 'direct',
        participantIds: [mockUser1, mockUser2],
      });

      expect(result).toEqual(existingConversation);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('should create a group conversation with valid data', async () => {
      const mockDocRef = { id: 'random-group-id-123' };
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await createConversation({
        type: 'group',
        participantIds: [mockUser1, mockUser2, mockUser3],
        groupName: 'Test Group',
        creatorId: mockUser1,
      });

      expect(result.type).toBe('group');
      expect(result.groupName).toBe('Test Group');
      expect(result.participantIds).toEqual([mockUser1, mockUser2, mockUser3]);
      expect(setDoc).toHaveBeenCalled();
    });

    it('should initialize per-user maps correctly', async () => {
      const mockDocRef = { id: 'user123_user456' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await createConversation({
        type: 'direct',
        participantIds: [mockUser1, mockUser2],
      });

      expect(result.unreadCount).toEqual({ user123: 0, user456: 0 });
      expect(result.archivedBy).toEqual({ user123: false, user456: false });
      expect(result.deletedBy).toEqual({ user123: false, user456: false });
      expect(result.mutedBy).toEqual({ user123: false, user456: false });
    });

    it('should reject conversation with less than 2 participants', async () => {
      await expect(
        createConversation({
          type: 'direct',
          participantIds: [mockUser1],
        })
      ).rejects.toThrow('Conversation requires at least 2 participants');
    });

    it('should reject direct conversation with more than 2 participants', async () => {
      await expect(
        createConversation({
          type: 'direct',
          participantIds: [mockUser1, mockUser2, mockUser3],
        })
      ).rejects.toThrow('Direct conversation requires exactly 2 participants');
    });

    it('should reject group conversation without group name', async () => {
      await expect(
        createConversation({
          type: 'group',
          participantIds: [mockUser1, mockUser2, mockUser3],
        })
      ).rejects.toThrow('Group conversation requires a group name');
    });

    it('should handle Firestore errors gracefully', async () => {
      const mockDocRef = { id: 'user123_user456' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
      (setDoc as jest.Mock).mockRejectedValue({ code: 'unknown' });

      await expect(
        createConversation({
          type: 'direct',
          participantIds: [mockUser1, mockUser2],
        })
      ).rejects.toThrow('Failed to create conversation');
    });
  });

  describe('getConversation', () => {
    it('should return conversation if exists', async () => {
      const mockConversation = {
        id: 'user123_user456',
        type: 'direct',
        participantIds: [mockUser1, mockUser2],
        lastMessage: { text: 'Hello', senderId: mockUser1, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });

      const result = await getConversation('user123_user456');

      expect(result).toEqual(mockConversation);
    });

    it('should return null if conversation does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const result = await getConversation('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle Firestore errors gracefully', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getConversation('user123_user456')).rejects.toThrow(
        'Failed to fetch conversation'
      );
    });
  });

  describe('getUserConversations', () => {
    it('should return conversations for a user sorted by lastMessageTimestamp', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          type: 'direct',
          participantIds: [mockUser1, mockUser2],
          lastMessageTimestamp: Timestamp.now(),
          deletedBy: { [mockUser1]: false },
        },
        {
          id: 'conv2',
          type: 'group',
          participantIds: [mockUser1, mockUser2, mockUser3],
          lastMessageTimestamp: Timestamp.now(),
          deletedBy: { [mockUser1]: false },
        },
      ];

      const mockSnapshot = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forEach: (callback: any) => {
          mockConversations.forEach((conv) => {
            callback({
              data: () => conv,
            });
          });
        },
      };

      (collection as jest.Mock).mockReturnValue('mock-collection');
      (query as jest.Mock).mockReturnValue('mock-query');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getUserConversations(mockUser1);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('conv1');
      expect(result[1].id).toBe('conv2');
      expect(where).toHaveBeenCalledWith('participantIds', 'array-contains', mockUser1);
      expect(orderBy).toHaveBeenCalledWith('lastMessageTimestamp', 'desc');
    });

    it('should filter out deleted conversations', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          deletedBy: { [mockUser1]: false },
        },
        {
          id: 'conv2',
          deletedBy: { [mockUser1]: true }, // Deleted by user
        },
        {
          id: 'conv3',
          deletedBy: { [mockUser1]: false },
        },
      ];

      const mockSnapshot = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forEach: (callback: any) => {
          mockConversations.forEach((conv) => {
            callback({
              data: () => conv,
            });
          });
        },
      };

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getUserConversations(mockUser1);

      expect(result).toHaveLength(2);
      expect(result.find((c) => c.id === 'conv2')).toBeUndefined();
    });

    it('should handle Firestore errors gracefully', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getUserConversations(mockUser1)).rejects.toThrow(
        'Failed to fetch conversations'
      );
    });
  });

  describe('updateConversationLastMessage', () => {
    it('should update last message and timestamp', async () => {
      const lastMessage = {
        text: 'Hello!',
        senderId: mockUser1,
        timestamp: Timestamp.now(),
      };

      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateConversationLastMessage(
        'user123_user456',
        lastMessage,
        [mockUser1, mockUser2],
        mockUser1
      );

      expect(updateDoc).toHaveBeenCalled();
      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateData.lastMessage).toEqual(lastMessage);
      expect(updateData.lastMessageTimestamp).toEqual(lastMessage.timestamp);
    });

    it('should increment unread count for non-sender participants', async () => {
      const lastMessage = {
        text: 'Hello!',
        senderId: mockUser1,
        timestamp: Timestamp.now(),
      };

      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateConversationLastMessage(
        'user123_user456',
        lastMessage,
        [mockUser1, mockUser2],
        mockUser1
      );

      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      // Should use Firestore increment for atomic updates
      expect(updateData['unreadCount.user456']).toEqual({ _methodName: 'increment', _operand: 1 });
      expect(updateData['unreadCount.user123']).toBeUndefined(); // sender should not have increment
    });

    it('should handle Firestore errors gracefully', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        updateConversationLastMessage(
          'user123_user456',
          {
            text: 'Hello',
            senderId: mockUser1,
            timestamp: Timestamp.now(),
          },
          [mockUser1, mockUser2],
          mockUser1
        )
      ).rejects.toThrow('Failed to update conversation');
    });
  });

  describe('markConversationAsRead', () => {
    it('should reset unread count to 0 for user', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await markConversationAsRead('user123_user456', mockUser1);

      expect(updateDoc).toHaveBeenCalled();
      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateData[`unreadCount.${mockUser1}`]).toBe(0);
      expect(updateData.updatedAt).toBeDefined();
    });

    it('should handle Firestore errors gracefully', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(markConversationAsRead('user123_user456', mockUser1)).rejects.toThrow(
        'Failed to mark conversation as read'
      );
    });
  });
});
