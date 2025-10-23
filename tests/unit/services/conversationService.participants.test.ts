/**
 * Unit tests for participant management in conversationService
 * @group unit
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Conversation } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase operations
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockArrayUnion = jest.fn((...items) => ({ _methodName: 'arrayUnion', _elements: items }));
const mockArrayRemove = jest.fn((item) => ({ _methodName: 'arrayRemove', _element: item }));
const mockServerTimestamp = jest.fn(() => ({ _methodName: 'serverTimestamp' }));

jest.mock('firebase/firestore', () => ({
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  arrayRemove: (...args: any[]) => mockArrayRemove(...args),
  serverTimestamp: () => mockServerTimestamp(),
  Timestamp: {
    now: () => ({ seconds: 1234567890, nanoseconds: 0 }),
    fromDate: (date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
  },
}));

const mockGetFirebaseDb = jest.fn(() => ({ _type: 'MockFirestore' }));
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: () => mockGetFirebaseDb(),
}));

// Import functions after mocking
import { addParticipants, removeParticipant } from '@/services/conversationService';

describe('Conversation Service - Participant Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockConversation: Conversation = {
    id: 'conv123',
    type: 'group',
    participantIds: ['creator123', 'user1', 'user2'],
    groupName: 'Test Group',
    creatorId: 'creator123',
    lastMessage: {
      text: 'Hello',
      senderId: 'creator123',
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

  describe('addParticipants', () => {
    it('should reject empty participant array', async () => {
      await expect(addParticipants('conv123', [], 'creator123')).rejects.toThrow(
        'No participants provided.'
      );
    });

    it('should reject if conversation not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(addParticipants('conv123', ['user3'], 'creator123')).rejects.toThrow(
        'Conversation not found.'
      );
    });

    it('should reject if conversation is not a group', async () => {
      const directConversation = {
        ...mockConversation,
        type: 'direct' as const,
      };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => directConversation,
      });

      await expect(addParticipants('conv123', ['user3'], 'creator123')).rejects.toThrow(
        'Can only add participants to group conversations.'
      );
    });

    it('should reject if user is not the creator', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });

      await expect(addParticipants('conv123', ['user3'], 'user1')).rejects.toThrow(
        'Only the group creator can add participants.'
      );
    });

    it('should reject if adding would exceed group size limit', async () => {
      const largeGroup = {
        ...mockConversation,
        participantIds: Array.from({ length: 48 }, (_, i) => `user${i}`),
      };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => largeGroup,
      });

      await expect(
        addParticipants('conv123', ['user48', 'user49', 'user50'], 'creator123')
      ).rejects.toThrow(/exceed limit of 50 members/);
    });

    it('should successfully add participants with arrayUnion', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });
      mockUpdateDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue({ id: 'conv123', path: 'conversations/conv123' });

      await addParticipants('conv123', ['user3', 'user4'], 'creator123');

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'conversations', 'conv123');
      expect(mockArrayUnion).toHaveBeenCalledWith('user3', 'user4');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participantIds: expect.objectContaining({
            _methodName: 'arrayUnion',
            _elements: ['user3', 'user4'],
          }),
        })
      );
    });

    it('should handle Firestore permission denied error', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });
      mockUpdateDoc.mockRejectedValue({ code: 'permission-denied' });

      await expect(addParticipants('conv123', ['user3'], 'creator123')).rejects.toThrow(
        'Permission denied. Only the group creator can add participants.'
      );
    });

    it('should handle generic Firestore errors', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });
      mockUpdateDoc.mockRejectedValue({ code: 'unavailable', message: 'Network error' });

      await expect(addParticipants('conv123', ['user3'], 'creator123')).rejects.toThrow(
        'Failed to add participants. Please try again.'
      );
    });

    it('should enforce group size limit at exactly 50 members', async () => {
      const almostFullGroup = {
        ...mockConversation,
        participantIds: Array.from({ length: 49 }, (_, i) => `user${i}`),
      };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => almostFullGroup,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      // Should succeed with 1 more participant (exactly 50)
      await expect(addParticipants('conv123', ['user49'], 'creator123')).resolves.not.toThrow();

      // Should fail with 2 more participants (51 total)
      await expect(addParticipants('conv123', ['user49', 'user50'], 'creator123')).rejects.toThrow(
        /exceed limit of 50 members/
      );
    });
  });

  describe('removeParticipant', () => {
    it('should reject if conversation not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(removeParticipant('conv123', 'user1', 'creator123')).rejects.toThrow(
        'Conversation not found.'
      );
    });

    it('should reject if conversation is not a group', async () => {
      const directConversation = {
        ...mockConversation,
        type: 'direct' as const,
      };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => directConversation,
      });

      await expect(removeParticipant('conv123', 'user1', 'creator123')).rejects.toThrow(
        'Can only remove participants from group conversations.'
      );
    });

    it('should reject if user is not the creator', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });

      await expect(removeParticipant('conv123', 'user1', 'user2')).rejects.toThrow(
        'Only the group creator can remove participants.'
      );
    });

    it('should prevent removing the creator', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });

      await expect(removeParticipant('conv123', 'creator123', 'creator123')).rejects.toThrow(
        'Cannot remove the group creator from the group.'
      );
    });

    it('should reject if participant is not in the group', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });

      await expect(removeParticipant('conv123', 'nonexistent', 'creator123')).rejects.toThrow(
        'User is not a participant in this group.'
      );
    });

    it('should successfully remove participant with arrayRemove and soft delete', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });
      mockUpdateDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue({ id: 'conv123', path: 'conversations/conv123' });

      await removeParticipant('conv123', 'user1', 'creator123');

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'conversations', 'conv123');
      expect(mockArrayRemove).toHaveBeenCalledWith('user1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participantIds: expect.objectContaining({
            _methodName: 'arrayRemove',
            _element: 'user1',
          }),
          'deletedBy.user1': true,
        })
      );
    });

    it('should handle Firestore permission denied error', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });
      mockUpdateDoc.mockRejectedValue({ code: 'permission-denied' });

      await expect(removeParticipant('conv123', 'user1', 'creator123')).rejects.toThrow(
        'Permission denied. Only the group creator can remove participants.'
      );
    });

    it('should handle generic Firestore errors', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      });
      mockUpdateDoc.mockRejectedValue({ code: 'unavailable', message: 'Network error' });

      await expect(removeParticipant('conv123', 'user1', 'creator123')).rejects.toThrow(
        'Failed to remove participant. Please try again.'
      );
    });
  });
});
