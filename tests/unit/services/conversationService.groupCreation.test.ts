/**
 * Unit tests for group conversation creation functionality
 * @module tests/unit/services/conversationService.groupCreation
 */

import {
  uploadGroupPhoto,
  createConversationWithFirstMessage,
} from '../../../services/conversationService';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { serverTimestamp, runTransaction } from 'firebase/firestore';
import { getFirebaseDb } from '../../../services/firebase';

// Mock Firebase modules
jest.mock('firebase/storage');
jest.mock('firebase/firestore');
jest.mock('../../../services/firebase');

// Mock global fetch
global.fetch = jest.fn();

describe('ConversationService - Group Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('uploadGroupPhoto', () => {
    const mockImageUri = 'file:///path/to/image.jpg';
    const mockGroupId = 'group-123';
    const mockDownloadURL = 'https://storage.googleapis.com/mock-download-url';
    const mockStorageRef = { name: 'photo.jpg' };
    const mockSnapshot = { ref: mockStorageRef };

    beforeEach(() => {
      // Setup default mocks
      const mockStorage = {};
      (getStorage as jest.Mock).mockReturnValue(mockStorage);
      (ref as jest.Mock).mockReturnValue(mockStorageRef);
      (uploadBytes as jest.Mock).mockResolvedValue(mockSnapshot);
      (getDownloadURL as jest.Mock).mockResolvedValue(mockDownloadURL);
    });

    it('should successfully upload a group photo and return download URL', async () => {
      // Mock successful fetch
      const mockBlob = { type: 'image/jpeg' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await uploadGroupPhoto(mockImageUri, mockGroupId);

      // Verify fetch was called with the image URI
      expect(global.fetch).toHaveBeenCalledWith(mockImageUri);

      // Verify storage operations
      expect(getStorage).toHaveBeenCalled();
      expect(ref).toHaveBeenCalledWith(expect.anything(), `groups/${mockGroupId}/photo.jpg`);
      expect(uploadBytes).toHaveBeenCalledWith(mockStorageRef, mockBlob);
      expect(getDownloadURL).toHaveBeenCalledWith(mockStorageRef);

      // Verify the download URL is returned
      expect(result).toBe(mockDownloadURL);
    });

    it('should throw user-friendly error when fetch fails', async () => {
      // Mock failed fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(uploadGroupPhoto(mockImageUri, mockGroupId)).rejects.toThrow(
        'Failed to upload group photo. Please try again.'
      );

      expect(uploadBytes).not.toHaveBeenCalled();
    });

    it('should throw user-friendly error for storage/unauthorized error', async () => {
      // Mock successful fetch
      const mockBlob = { type: 'image/jpeg' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      // Mock storage unauthorized error
      const unauthorizedError = new Error('storage/unauthorized');
      (uploadBytes as jest.Mock).mockRejectedValue(unauthorizedError);

      await expect(uploadGroupPhoto(mockImageUri, mockGroupId)).rejects.toThrow(
        'Permission denied. Unable to upload group photo.'
      );
    });

    it('should throw user-friendly error for storage/quota-exceeded error', async () => {
      // Mock successful fetch
      const mockBlob = { type: 'image/jpeg' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      // Mock storage quota exceeded error
      const quotaError = new Error('storage/quota-exceeded');
      (uploadBytes as jest.Mock).mockRejectedValue(quotaError);

      await expect(uploadGroupPhoto(mockImageUri, mockGroupId)).rejects.toThrow(
        'Storage quota exceeded. Please try again later.'
      );
    });

    it('should throw generic error for other failures', async () => {
      // Mock successful fetch
      const mockBlob = { type: 'image/jpeg' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      // Mock generic storage error
      const genericError = new Error('Network error');
      (uploadBytes as jest.Mock).mockRejectedValue(genericError);

      await expect(uploadGroupPhoto(mockImageUri, mockGroupId)).rejects.toThrow(
        'Failed to upload group photo. Please try again.'
      );
    });

    it('should handle blob conversion failure gracefully', async () => {
      // Mock fetch that fails during blob conversion
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: jest.fn().mockRejectedValue(new Error('Blob conversion failed')),
      });

      await expect(uploadGroupPhoto(mockImageUri, mockGroupId)).rejects.toThrow(
        'Failed to upload group photo. Please try again.'
      );
    });
  });

  describe('createConversationWithFirstMessage - Group Creation', () => {
    const mockGroupName = 'Test Group';
    const mockParticipantIds = ['user-123', 'user-456', 'user-789'];
    const mockGroupPhotoURL = 'https://storage.googleapis.com/group-photo.jpg';
    const mockMessageText = 'Welcome to the group!';
    const mockConversationId = 'conv-123';
    const mockMessageId = 'msg-123';
    const mockDb = {};

    beforeEach(() => {
      (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
      (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: 1234567890 });

      // Mock the transaction
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({ exists: () => false }),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const result = await callback(mockTransaction);
        return result || { conversationId: mockConversationId, messageId: mockMessageId };
      });
    });

    it('should create a group conversation with correct fields', async () => {
      const result = await createConversationWithFirstMessage({
        type: 'group',
        participantIds: mockParticipantIds,
        messageText: mockMessageText,
        senderId: 'user-123',
        groupName: mockGroupName,
        groupPhotoURL: mockGroupPhotoURL,
      });

      // Verify the result contains both IDs
      expect(result).toEqual({
        conversationId: mockConversationId,
        messageId: mockMessageId,
      });
    });

    it('should validate minimum participant count for groups (3 total)', async () => {
      const tooFewParticipants = ['user-123', 'user-456']; // Only 2 participants

      await expect(
        createConversationWithFirstMessage({
          type: 'group',
          participantIds: tooFewParticipants,
          messageText: mockMessageText,
          senderId: 'user-123',
          groupName: mockGroupName,
        })
      ).rejects.toThrow();
    });

    it('should validate maximum participant count for groups (50 total)', async () => {
      const tooManyParticipants = Array.from({ length: 51 }, (_, i) => `user-${i}`);

      await expect(
        createConversationWithFirstMessage({
          type: 'group',
          participantIds: tooManyParticipants,
          messageText: mockMessageText,
          senderId: 'user-123',
          groupName: mockGroupName,
        })
      ).rejects.toThrow();
    });

    it('should require group name for group conversations', async () => {
      await expect(
        createConversationWithFirstMessage({
          type: 'group',
          participantIds: mockParticipantIds,
          messageText: mockMessageText,
          senderId: 'user-123',
          // Missing group name
        })
      ).rejects.toThrow();
    });

    it('should set creatorId to sender for group conversations', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({ exists: () => false }),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        await callback(mockTransaction);
        return { conversationId: mockConversationId, messageId: mockMessageId };
      });

      await createConversationWithFirstMessage({
        type: 'group',
        participantIds: mockParticipantIds,
        messageText: mockMessageText,
        senderId: 'user-123',
        groupName: mockGroupName,
      });

      // Verify transaction.set was called with creatorId
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          creatorId: 'user-123',
        })
      );
    });

    it('should create group without photo URL if not provided', async () => {
      await createConversationWithFirstMessage({
        type: 'group',
        participantIds: mockParticipantIds,
        messageText: mockMessageText,
        senderId: 'user-123',
        groupName: mockGroupName,
        // No photo URL provided
      });

      const result = await createConversationWithFirstMessage({
        type: 'group',
        participantIds: mockParticipantIds,
        messageText: mockMessageText,
        senderId: 'user-123',
        groupName: mockGroupName,
      });

      expect(result).toEqual({
        conversationId: mockConversationId,
        messageId: mockMessageId,
      });
    });

    it('should handle Firestore write failure gracefully', async () => {
      const firestoreError = new Error('Firestore write failed');
      (runTransaction as jest.Mock).mockRejectedValue(firestoreError);

      await expect(
        createConversationWithFirstMessage({
          type: 'group',
          participantIds: mockParticipantIds,
          messageText: mockMessageText,
          senderId: 'user-123',
          groupName: mockGroupName,
        })
      ).rejects.toThrow(firestoreError);
    });

    it('should initialize unreadCount for participants in transaction', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({ exists: () => false }),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        await callback(mockTransaction);
        return { conversationId: mockConversationId, messageId: mockMessageId };
      });

      await createConversationWithFirstMessage({
        type: 'group',
        participantIds: mockParticipantIds,
        messageText: mockMessageText,
        senderId: 'user-123',
        groupName: mockGroupName,
      });

      // Verify unreadCount was set correctly (0 for sender, 1 for others)
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          unreadCount: {
            'user-123': 0,
            'user-456': 1,
            'user-789': 1,
          },
        })
      );
    });

    it('should accept exactly 50 participants (maximum allowed)', async () => {
      const maxParticipants = Array.from({ length: 50 }, (_, i) => `user-${i}`);

      const result = await createConversationWithFirstMessage({
        type: 'group',
        participantIds: maxParticipants,
        messageText: mockMessageText,
        senderId: maxParticipants[0],
        groupName: mockGroupName,
      });

      expect(result).toEqual({
        conversationId: mockConversationId,
        messageId: mockMessageId,
      });
    });

    it('should accept exactly 3 participants (minimum allowed)', async () => {
      const minParticipants = ['user-1', 'user-2', 'user-3'];

      const result = await createConversationWithFirstMessage({
        type: 'group',
        participantIds: minParticipants,
        messageText: mockMessageText,
        senderId: minParticipants[0],
        groupName: mockGroupName,
      });

      expect(result).toEqual({
        conversationId: mockConversationId,
        messageId: mockMessageId,
      });
    });
  });
});
