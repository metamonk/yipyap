/**
 * Unit tests for conversation batch operations (Story 4.7)
 */

import {
  batchArchiveConversations,
  batchDeleteConversations,
} from '@/services/conversationService';
import { writeBatch } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  writeBatch: jest.fn(() => ({
    update: jest.fn(),
    commit: jest.fn(),
  })),
  doc: jest.fn((db, ...pathSegments) => ({
    path: pathSegments.join('/'),
  })),
  collection: jest.fn((db, collectionName) => ({
    path: collectionName,
  })),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 })),
}));

// Mock Firebase service
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({
    _type: 'firestore',
  })),
}));

describe('Conversation Service - Batch Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('batchArchiveConversations', () => {
    const userId = 'user1';

    it('should batch archive multiple conversations successfully', async () => {
      const conversationIds = ['conv1', 'conv2', 'conv3'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchArchiveConversations(conversationIds, userId, true);

      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);

      // Verify each conversation was updated
      conversationIds.forEach((id, index) => {
        expect(mockBatch.update).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({ path: `conversations/${id}` }),
          expect.objectContaining({
            [`archivedBy.${userId}`]: true,
            updatedAt: expect.anything(),
          })
        );
      });
    });

    it('should batch unarchive multiple conversations successfully', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchArchiveConversations(conversationIds, userId, false);

      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      conversationIds.forEach((id, index) => {
        expect(mockBatch.update).toHaveBeenNthCalledWith(
          index + 1,
          expect.any(Object),
          expect.objectContaining({
            [`archivedBy.${userId}`]: false,
          })
        );
      });
    });

    it('should throw error when no conversations provided', async () => {
      await expect(batchArchiveConversations([], userId, true)).rejects.toThrow(
        'No conversations provided'
      );
    });

    it('should throw error when conversationIds array is undefined', async () => {
      await expect(batchArchiveConversations(undefined as any, userId, true)).rejects.toThrow(
        'No conversations provided'
      );
    });

    it('should throw error when batch limit exceeded (>500)', async () => {
      const conversationIds = Array.from({ length: 501 }, (_, i) => `conv${i}`);

      await expect(batchArchiveConversations(conversationIds, userId, true)).rejects.toThrow(
        'Batch operation limit exceeded. Maximum 500 conversations allowed'
      );
    });

    it('should handle exactly 500 conversations (limit)', async () => {
      const conversationIds = Array.from({ length: 500 }, (_, i) => `conv${i}`);
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchArchiveConversations(conversationIds, userId, true);

      expect(mockBatch.update).toHaveBeenCalledTimes(500);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('should handle single conversation', async () => {
      const conversationIds = ['conv1'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchArchiveConversations(conversationIds, userId, true);

      expect(mockBatch.update).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('should handle permission-denied error', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce({
          code: 'permission-denied',
        }),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchArchiveConversations(conversationIds, userId, true)).rejects.toThrow(
        'Permission denied. Unable to archive conversations'
      );
    });

    it('should handle not-found error', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce({
          code: 'not-found',
        }),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchArchiveConversations(conversationIds, userId, true)).rejects.toThrow(
        'One or more conversations not found'
      );
    });

    it('should handle network errors', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce(new Error('Network error')),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchArchiveConversations(conversationIds, userId, true)).rejects.toThrow(
        'Failed to archive conversations. Please try again'
      );
    });

    it('should be atomic - all or nothing', async () => {
      const conversationIds = ['conv1', 'conv2', 'conv3'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce(new Error('Batch failed')),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchArchiveConversations(conversationIds, userId, true)).rejects.toThrow();

      // Verify commit was called (batch attempted)
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('batchDeleteConversations', () => {
    const userId = 'user1';

    it('should batch delete multiple conversations successfully', async () => {
      const conversationIds = ['conv1', 'conv2', 'conv3'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchDeleteConversations(conversationIds, userId);

      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);

      // Verify soft delete via deletedBy flag (NOT hard delete)
      conversationIds.forEach((id, index) => {
        expect(mockBatch.update).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({ path: `conversations/${id}` }),
          expect.objectContaining({
            [`deletedBy.${userId}`]: true,
            updatedAt: expect.anything(),
          })
        );
      });
    });

    it('should use soft delete (deletedBy flag), not hard delete', async () => {
      const conversationIds = ['conv1'];
      const mockBatch = {
        update: jest.fn(),
        delete: jest.fn(), // Should NOT be called
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchDeleteConversations(conversationIds, userId);

      // Verify update was called (soft delete)
      expect(mockBatch.update).toHaveBeenCalled();
      // Verify delete was NOT called (no hard delete)
      expect(mockBatch.delete).not.toHaveBeenCalled();
    });

    it('should throw error when no conversations provided', async () => {
      await expect(batchDeleteConversations([], userId)).rejects.toThrow(
        'No conversations provided'
      );
    });

    it('should throw error when conversationIds array is undefined', async () => {
      await expect(batchDeleteConversations(undefined as any, userId)).rejects.toThrow(
        'No conversations provided'
      );
    });

    it('should throw error when batch limit exceeded (>500)', async () => {
      const conversationIds = Array.from({ length: 501 }, (_, i) => `conv${i}`);

      await expect(batchDeleteConversations(conversationIds, userId)).rejects.toThrow(
        'Batch operation limit exceeded. Maximum 500 conversations allowed'
      );
    });

    it('should handle exactly 500 conversations (limit)', async () => {
      const conversationIds = Array.from({ length: 500 }, (_, i) => `conv${i}`);
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchDeleteConversations(conversationIds, userId);

      expect(mockBatch.update).toHaveBeenCalledTimes(500);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('should handle single conversation', async () => {
      const conversationIds = ['conv1'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await batchDeleteConversations(conversationIds, userId);

      expect(mockBatch.update).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('should handle permission-denied error', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce({
          code: 'permission-denied',
        }),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchDeleteConversations(conversationIds, userId)).rejects.toThrow(
        'Permission denied. Unable to delete conversations'
      );
    });

    it('should handle not-found error', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce({
          code: 'not-found',
        }),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchDeleteConversations(conversationIds, userId)).rejects.toThrow(
        'One or more conversations not found'
      );
    });

    it('should handle network errors', async () => {
      const conversationIds = ['conv1', 'conv2'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce(new Error('Network error')),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchDeleteConversations(conversationIds, userId)).rejects.toThrow(
        'Failed to delete conversations. Please try again'
      );
    });

    it('should be atomic - all or nothing', async () => {
      const conversationIds = ['conv1', 'conv2', 'conv3'];
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce(new Error('Batch failed')),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch);

      await expect(batchDeleteConversations(conversationIds, userId)).rejects.toThrow();

      // Verify commit was called (batch attempted)
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should preserve data for other participants (soft delete concept)', async () => {
      const conversationIds = ['conv1'];
      const user1 = 'user1';
      const user2 = 'user2';

      // User 1 deletes conversation
      const mockBatch1 = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch1);

      await batchDeleteConversations(conversationIds, user1);

      // Verify only user1's deletedBy flag is set
      expect(mockBatch1.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          [`deletedBy.${user1}`]: true,
        })
      );

      // User 2 can still delete independently
      const mockBatch2 = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValueOnce(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValueOnce(mockBatch2);

      await batchDeleteConversations(conversationIds, user2);

      // Verify user2's deletedBy flag is set
      expect(mockBatch2.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          [`deletedBy.${user2}`]: true,
        })
      );
    });
  });
});
