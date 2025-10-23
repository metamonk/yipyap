/**
 * Unit tests for group admin and management functions in conversationService
 */

 
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  isGroupAdmin,
  updateGroupSettings,
  leaveGroup,
  removeMember,
} from '@/services/conversationService';
import type { Conversation } from '@/types/models';
import { Timestamp, getDoc, updateDoc } from 'firebase/firestore';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ seconds: Date.now() / 1000 })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

describe('conversationService - Admin Functions', () => {
  describe('isGroupAdmin', () => {
    it('should return false for null conversation', () => {
      const result = isGroupAdmin(null, 'user123');
      expect(result).toBe(false);
    });

    it('should return false for direct conversation', () => {
      const conversation: Conversation = {
        id: 'conv123',
        type: 'direct',
        participantIds: ['user123', 'user456'],
        lastMessage: { text: 'test', senderId: 'user123', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const result = isGroupAdmin(conversation, 'user123');
      expect(result).toBe(false);
    });

    it('should return true when user is in adminIds array', () => {
      const conversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['user123', 'user456', 'user789'],
        groupName: 'Test Group',
        adminIds: ['user123', 'user456'],
        creatorId: 'user123',
        lastMessage: { text: 'test', senderId: 'user123', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      expect(isGroupAdmin(conversation, 'user123')).toBe(true);
      expect(isGroupAdmin(conversation, 'user456')).toBe(true);
      expect(isGroupAdmin(conversation, 'user789')).toBe(false);
    });

    it('should fallback to creatorId when adminIds is empty', () => {
      const conversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['user123', 'user456'],
        groupName: 'Test Group',
        adminIds: [],
        creatorId: 'user123',
        lastMessage: { text: 'test', senderId: 'user123', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      expect(isGroupAdmin(conversation, 'user123')).toBe(true);
      expect(isGroupAdmin(conversation, 'user456')).toBe(false);
    });

    it('should fallback to creatorId when adminIds is undefined', () => {
      const conversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['user123', 'user456'],
        groupName: 'Test Group',
        creatorId: 'user123',
        lastMessage: { text: 'test', senderId: 'user123', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      expect(isGroupAdmin(conversation, 'user123')).toBe(true);
      expect(isGroupAdmin(conversation, 'user456')).toBe(false);
    });
  });

  describe('updateGroupSettings', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw error if user is not an admin', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'user2'],
        groupName: 'Test Group',
        adminIds: ['admin1'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      await expect(
        updateGroupSettings('group123', { groupName: 'New Name' }, 'user2')
      ).rejects.toThrow('Only group admins can update group settings.');

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should successfully update group name when user is admin', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'user2'],
        groupName: 'Test Group',
        adminIds: ['admin1'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      (updateDoc as jest.MockedFunction<typeof updateDoc>).mockResolvedValue(undefined);

      await updateGroupSettings('group123', { groupName: 'New Name' }, 'admin1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          groupName: 'New Name',
        })
      );
    });

    it('should throw error when trying to update direct conversation', async () => {

      const mockConversation: Conversation = {
        id: 'conv123',
        type: 'direct',
        participantIds: ['user1', 'user2'],
        lastMessage: { text: 'test', senderId: 'user1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      await expect(
        updateGroupSettings('conv123', { groupName: 'New Name' }, 'user1')
      ).rejects.toThrow('Can only update settings for group conversations.');
    });
  });

  describe('leaveGroup', () => {
    it('should handle last admin leaving by transferring admin role', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'user2', 'user3'],
        groupName: 'Test Group',
        adminIds: ['admin1'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      (updateDoc as jest.MockedFunction<typeof updateDoc>).mockResolvedValue(undefined);

      await leaveGroup('group123', 'admin1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participantIds: ['user2', 'user3'],
          adminIds: ['user2'], // First remaining participant becomes admin
        })
      );
    });

    it('should successfully remove regular member without admin transfer', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'user2', 'user3'],
        groupName: 'Test Group',
        adminIds: ['admin1'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      (updateDoc as jest.MockedFunction<typeof updateDoc>).mockResolvedValue(undefined);

      await leaveGroup('group123', 'user2');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participantIds: ['admin1', 'user3'],
          adminIds: ['admin1'], // Admin remains unchanged
        })
      );
    });

    it('should throw error when trying to leave direct conversation', async () => {

      const mockConversation: Conversation = {
        id: 'conv123',
        type: 'direct',
        participantIds: ['user1', 'user2'],
        lastMessage: { text: 'test', senderId: 'user1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      await expect(leaveGroup('conv123', 'user1')).rejects.toThrow(
        'Can only leave group conversations.'
      );
    });
  });

  describe('removeMember', () => {
    it('should prevent removing other admins', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'admin2', 'user3'],
        groupName: 'Test Group',
        adminIds: ['admin1', 'admin2'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      await expect(removeMember('group123', 'admin2', 'admin1')).rejects.toThrow(
        'Cannot remove other admins. They must leave voluntarily.'
      );

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should allow admins to remove regular members', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'user2', 'user3'],
        groupName: 'Test Group',
        adminIds: ['admin1'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      (updateDoc as jest.MockedFunction<typeof updateDoc>).mockResolvedValue(undefined);

      await removeMember('group123', 'user2', 'admin1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participantIds: ['admin1', 'user3'],
        })
      );
    });

    it('should throw error when non-admin tries to remove member', async () => {

      const mockConversation: Conversation = {
        id: 'group123',
        type: 'group',
        participantIds: ['admin1', 'user2', 'user3'],
        groupName: 'Test Group',
        adminIds: ['admin1'],
        lastMessage: { text: 'test', senderId: 'admin1', timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (getDoc as jest.MockedFunction<typeof getDoc>).mockResolvedValue({
        exists: () => true,
        data: () => mockConversation,
      } as any);

      await expect(removeMember('group123', 'user3', 'user2')).rejects.toThrow(
        'Only group admins can remove members.'
      );

      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
