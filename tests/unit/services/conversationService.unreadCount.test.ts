/**
 * Unit tests for conversation service unread count reset functionality
 * @module tests/unit/services/conversationService.unreadCount
 */

import { markConversationAsRead } from '@/services/conversationService';
import { getFirebaseDb } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase');

// Mock Firestore functions
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _methodName: 'serverTimestamp' }));

jest.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

describe('Conversation Service - Unread Count Reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue({});
    mockDoc.mockReturnValue('mockDocRef');
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('markConversationAsRead', () => {
    it('should reset unread count to 0 for specific user', async () => {
      await markConversationAsRead('conv123', 'user456');

      expect(mockDoc).toHaveBeenCalledWith({}, 'conversations', 'conv123');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mockDocRef', {
        'unreadCount.user456': 0,
        updatedAt: expect.anything(),
      });
    });

    it('should not affect other users unread counts', async () => {
      await markConversationAsRead('conv123', 'user1');

      // Verify only user1's unread count is updated
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        expect.objectContaining({
          'unreadCount.user1': 0,
        })
      );

      // Should not include other users
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      const keys = Object.keys(updateCall);
      const unreadCountKeys = keys.filter((k) => k.startsWith('unreadCount.'));

      expect(unreadCountKeys).toHaveLength(1);
      expect(unreadCountKeys[0]).toBe('unreadCount.user1');
    });

    it('should handle multiple calls for same conversation', async () => {
      await markConversationAsRead('conv123', 'user1');
      await markConversationAsRead('conv123', 'user1');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
      expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, 'mockDocRef', {
        'unreadCount.user1': 0,
        updatedAt: expect.anything(),
      });
      expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, 'mockDocRef', {
        'unreadCount.user1': 0,
        updatedAt: expect.anything(),
      });
    });

    it('should handle different users in same conversation', async () => {
      await markConversationAsRead('conv123', 'user1');
      await markConversationAsRead('conv123', 'user2');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
      expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, 'mockDocRef', {
        'unreadCount.user1': 0,
        updatedAt: expect.anything(),
      });
      expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, 'mockDocRef', {
        'unreadCount.user2': 0,
        updatedAt: expect.anything(),
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Firestore update failed');
      mockUpdateDoc.mockRejectedValueOnce(error);

      await expect(markConversationAsRead('conv123', 'user1')).rejects.toThrow(
        'Failed to mark conversation as read'
      );
    });

    it('should handle permission denied errors', async () => {
      const error = { code: 'permission-denied', message: 'Permission denied' };
      mockUpdateDoc.mockRejectedValueOnce(error);

      await expect(markConversationAsRead('conv123', 'user1')).rejects.toThrow();
    });

    it('should handle conversation not found errors', async () => {
      const error = { code: 'not-found', message: 'Conversation not found' };
      mockUpdateDoc.mockRejectedValueOnce(error);

      await expect(markConversationAsRead('conv123', 'user1')).rejects.toThrow();
    });

    it('should update updatedAt timestamp', async () => {
      await markConversationAsRead('conv123', 'user1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        expect.objectContaining({
          updatedAt: expect.anything(),
        })
      );
    });
  });

  describe('markConversationAsRead - edge cases', () => {
    it('should handle special characters in user ID', async () => {
      const specialUserId = 'user@123.com';
      await markConversationAsRead('conv123', specialUserId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        expect.objectContaining({
          'unreadCount.user@123.com': 0,
        })
      );
    });

    it('should be idempotent when called multiple times rapidly', async () => {
      const promises = [
        markConversationAsRead('conv123', 'user1'),
        markConversationAsRead('conv123', 'user1'),
        markConversationAsRead('conv123', 'user1'),
      ];

      await Promise.all(promises);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(3);
      // All calls should have same structure
      mockUpdateDoc.mock.calls.forEach((call) => {
        expect(call[1]).toEqual({
          'unreadCount.user1': 0,
          updatedAt: expect.anything(),
        });
      });
    });
  });
});
