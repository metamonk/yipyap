/**
 * Unit tests for conversation deletion service functions
 * @module tests/unit/services/conversationService.delete
 */

import {
  deleteConversation,
  subscribeToConversations,
  subscribeToArchivedConversations,
} from '@/services/conversationService';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';

// Mock Firebase modules
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
  collection: jest.fn(),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  orderBy: jest.fn((...args) => args),
}));
jest.mock('@/services/firebase');

const mockGetFirebaseDb = getFirebaseDb as jest.MockedFunction<typeof getFirebaseDb>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;

describe('conversationService - Delete Functionality', () => {
  const mockDb = {} as any;
  const mockConversationRef = {} as any;
  const testConversationId = 'test-conversation-123';
  const testUserId = 'test-user-456';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirebaseDb.mockReturnValue(mockDb);
    mockDoc.mockReturnValue(mockConversationRef);
  });

  describe('deleteConversation', () => {
    it('should set deletedBy.userId to true for soft delete', async () => {
      // Mock conversation exists and user is participant
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: testConversationId,
          participantIds: [testUserId, 'other-user'],
          deletedBy: {},
        }),
      } as any);

      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await deleteConversation(testConversationId, testUserId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        mockConversationRef,
        expect.objectContaining({
          [`deletedBy.${testUserId}`]: true,
        })
      );
    });

    it('should update updatedAt timestamp', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: testConversationId,
          participantIds: [testUserId, 'other-user'],
        }),
      } as any);

      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await deleteConversation(testConversationId, testUserId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        mockConversationRef,
        expect.objectContaining({
          updatedAt: expect.anything(),
        })
      );
    });

    it('should throw error if conversation not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      } as any);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow(
        'Conversation not found.'
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should throw error if user is not a participant', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: testConversationId,
          participantIds: ['other-user-1', 'other-user-2'],
        }),
      } as any);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow(
        'You must be a participant in this conversation to delete it.'
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: testConversationId,
          participantIds: [testUserId, 'other-user'],
        }),
      } as any);

      const firestoreError = new Error('Firestore error');
      (firestoreError as any).code = 'permission-denied';
      mockUpdateDoc.mockRejectedValueOnce(firestoreError);

      await expect(deleteConversation(testConversationId, testUserId)).rejects.toThrow(
        'Permission denied. Unable to delete conversation.'
      );
    });

    it('should not delete messages subcollection (soft delete only)', async () => {
      // This test verifies that we only call updateDoc, never deleteDoc
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: testConversationId,
          participantIds: [testUserId, 'other-user'],
        }),
      } as any);

      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await deleteConversation(testConversationId, testUserId);

      // Verify updateDoc was called (soft delete)
      expect(mockUpdateDoc).toHaveBeenCalled();

      // Verify we never call deleteDoc (hard delete)
      const deleteDoc = require('firebase/firestore').deleteDoc;
      if (deleteDoc && deleteDoc.mock) {
        expect(deleteDoc).not.toHaveBeenCalled();
      }
    });
  });

  describe('subscribeToConversations', () => {
    it('should filter out deleted conversations', async () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      // Mock conversations data - some deleted, some not
      const mockSnapshot = {
        forEach: (callback: any) => {
          // Not deleted
          callback({
            data: () => ({
              id: 'conv1',
              deletedBy: { [testUserId]: false },
              archivedBy: { [testUserId]: false },
            }),
          });

          // Deleted by testUserId
          callback({
            data: () => ({
              id: 'conv2',
              deletedBy: { [testUserId]: true },
              archivedBy: { [testUserId]: false },
            }),
          });

          // Not deleted
          callback({
            data: () => ({
              id: 'conv3',
              deletedBy: {},
              archivedBy: { [testUserId]: false },
            }),
          });
        },
      };

      mockOnSnapshot.mockImplementation((q, successCallback: any) => {
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToConversations(testUserId, mockCallback);

      // Should only include non-deleted conversations
      expect(mockCallback).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'conv1' }),
        expect.objectContaining({ id: 'conv3' }),
      ]);

      // Should not include deleted conversation
      expect(mockCallback).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'conv2' })])
      );
    });
  });

  describe('subscribeToArchivedConversations', () => {
    it('should filter out deleted conversations from archived list', async () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      // Mock conversations data - archived but some deleted
      const mockSnapshot = {
        forEach: (callback: any) => {
          // Archived and NOT deleted
          callback({
            data: () => ({
              id: 'conv1',
              archivedBy: { [testUserId]: true },
              deletedBy: { [testUserId]: false },
            }),
          });

          // Archived AND deleted (should be excluded)
          callback({
            data: () => ({
              id: 'conv2',
              archivedBy: { [testUserId]: true },
              deletedBy: { [testUserId]: true },
            }),
          });

          // Archived and NOT deleted
          callback({
            data: () => ({
              id: 'conv3',
              archivedBy: { [testUserId]: true },
              deletedBy: {},
            }),
          });
        },
      };

      mockOnSnapshot.mockImplementation((q, successCallback: any) => {
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToArchivedConversations(testUserId, mockCallback);

      // Should only include archived and non-deleted conversations
      expect(mockCallback).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'conv1' }),
        expect.objectContaining({ id: 'conv3' }),
      ]);

      // Should not include deleted conversation (even though archived)
      expect(mockCallback).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'conv2' })])
      );
    });

    it('should verify deletion takes precedence over archiving', async () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      const mockSnapshot = {
        forEach: (callback: any) => {
          // Conversation that is BOTH archived AND deleted
          callback({
            data: () => ({
              id: 'conv-both',
              archivedBy: { [testUserId]: true },
              deletedBy: { [testUserId]: true },
            }),
          });
        },
      };

      mockOnSnapshot.mockImplementation((q, successCallback: any) => {
        successCallback(mockSnapshot);
        return mockUnsubscribe;
      });

      subscribeToArchivedConversations(testUserId, mockCallback);

      // Should return empty array - deleted conversations hidden even if archived
      expect(mockCallback).toHaveBeenCalledWith([]);
    });
  });
});
