/**
 * Unit tests for Bulk Operations Service
 *
 * @remarks
 * Tests bulk operations for archiving, marking as read, and approving suggestions
 */

import { bulkOperationsService, BulkOperationsService } from '../../../services/bulkOperationsService';
import { getFirebaseDb } from '../../../services/firebase';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('../../../services/firebase', () => ({
  getFirebaseDb: jest.fn(),
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: {
    fromDate: (date: Date) => ({ toDate: () => date, toMillis: () => date.getTime() }),
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
  },
}));

describe('BulkOperationsService', () => {
  let mockFirestore: any;
  let mockBatch: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock batch
    mockBatch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock Firestore
    mockFirestore = {
      collection: jest.fn(),
    };

    (getFirebaseDb as jest.Mock).mockReturnValue(mockFirestore);
    const { writeBatch } = require('firebase/firestore');
    writeBatch.mockReturnValue(mockBatch);
  });

  describe('archiveAllRead', () => {
    it('should archive conversations with 0 unread count', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              id: 'conv1',
              participantIds: ['user123', 'user456'],
              unreadCount: { user123: 0, user456: 5 },
              archivedBy: {},
            }),
          },
          {
            id: 'conv2',
            data: () => ({
              id: 'conv2',
              participantIds: ['user123', 'user789'],
              unreadCount: { user123: 3, user789: 0 },
              archivedBy: {},
            }),
          },
          {
            id: 'conv3',
            data: () => ({
              id: 'conv3',
              participantIds: ['user123', 'user101'],
              unreadCount: { user123: 0, user101: 0 },
              archivedBy: {},
            }),
          },
        ],
      };

      getDocs.mockResolvedValue(mockConversations);

      const result = await bulkOperationsService.archiveAllRead('user123');

      expect(result.totalProcessed).toBe(2); // conv1 and conv3 have 0 unread for user123
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.completed).toBe(true);
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty conversation list', async () => {
      const { getDocs } = require('firebase/firestore');

      getDocs.mockResolvedValue({ docs: [] });

      const result = await bulkOperationsService.archiveAllRead('user123');

      expect(result.totalProcessed).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.completed).toBe(true);
    });

    it('should call progress callback', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              id: 'conv1',
              participantIds: ['user123'],
              unreadCount: { user123: 0 },
              archivedBy: {},
            }),
          },
        ],
      };

      getDocs.mockResolvedValue(mockConversations);

      const progressCallback = jest.fn();
      await bulkOperationsService.archiveAllRead('user123', progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(1, 1, 100);
    });

    it('should handle batch failures gracefully', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              id: 'conv1',
              participantIds: ['user123'],
              unreadCount: { user123: 0 },
              archivedBy: {},
            }),
          },
        ],
      };

      getDocs.mockResolvedValue(mockConversations);
      mockBatch.commit.mockRejectedValue(new Error('Firestore error'));

      const result = await bulkOperationsService.archiveAllRead('user123');

      expect(result.totalProcessed).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.completed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should update archivedBy field correctly', async () => {
      const { getDocs, doc } = require('firebase/firestore');

      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              id: 'conv1',
              participantIds: ['user123'],
              unreadCount: { user123: 0 },
              archivedBy: {},
            }),
          },
        ],
      };

      getDocs.mockResolvedValue(mockConversations);
      const mockDocRef = { path: 'conversations/conv1' };
      doc.mockReturnValue(mockDocRef);

      await bulkOperationsService.archiveAllRead('user123');

      expect(mockBatch.update).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          'archivedBy.user123': true,
        })
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark unread messages as read', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              readBy: ['user456'],
              status: 'delivered',
            }),
          },
          {
            id: 'msg2',
            data: () => ({
              readBy: [],
              status: 'delivered',
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        // First call returns conversations
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        // Second call returns messages
        return Promise.resolve(mockMessages);
      });

      const result = await bulkOperationsService.markAllAsRead('user123');

      expect(result.totalProcessed).toBe(2); // Both messages unread for user123
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.completed).toBe(true);
    });

    it('should not update already read messages', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            data: () => ({
              readBy: ['user123', 'user456'],
              status: 'read',
            }),
          },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const result = await bulkOperationsService.markAllAsRead('user123');

      expect(result.totalProcessed).toBe(0); // msg1 already read
      expect(result.successCount).toBe(0);
      expect(result.completed).toBe(true);
    });

    it('should handle multiple conversations', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }, { id: 'conv2' }],
      };

      const mockMessages1 = {
        docs: [
          { id: 'msg1', data: () => ({ readBy: [] }) },
        ],
      };

      const mockMessages2 = {
        docs: [
          { id: 'msg2', data: () => ({ readBy: [] }) },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        const callCount = getDocs.mock.calls.length;
        if (callCount === 1) return Promise.resolve(mockConversations);
        if (callCount === 2) return Promise.resolve(mockMessages1);
        return Promise.resolve(mockMessages2);
      });

      const result = await bulkOperationsService.markAllAsRead('user123');

      expect(result.totalProcessed).toBe(2); // 1 from conv1 + 1 from conv2
      expect(result.successCount).toBe(2);
    });

    it('should call progress callback', async () => {
      const { getDocs } = require('firebase/firestore');

      const mockConversations = {
        docs: [{ id: 'conv1' }],
      };

      const mockMessages = {
        docs: [
          { id: 'msg1', data: () => ({ readBy: [] }) },
        ],
      };

      getDocs.mockImplementation((q: any) => {
        if (getDocs.mock.calls.length === 1) {
          return Promise.resolve(mockConversations);
        }
        return Promise.resolve(mockMessages);
      });

      const progressCallback = jest.fn();
      await bulkOperationsService.markAllAsRead('user123', progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(1, 1, 100);
    });
  });
});
