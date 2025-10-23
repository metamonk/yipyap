/**
 * Unit tests for message delivery status logic
 *
 * @remarks
 * Tests the delivery status functionality from Story 3.2:
 * - markMessageAsDelivered() function behavior
 * - sendMessage() status transitions (sending → delivered)
 * - Idempotency of delivery status updates
 * - Error handling and retry logic
 * - Offline queue integration
 */

import { markMessageAsDelivered, sendMessage } from '@/services/messageService';
import { RetryQueue } from '@/services/retryQueueService';
import { getFirebaseDb } from '@/services/firebase';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

// Mock Firebase services
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(),
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => {
  const FirestoreError = class FirestoreError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'FirestoreError';
    }
  };

  return {
    doc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    addDoc: jest.fn(),
    collection: jest.fn(),
    serverTimestamp: jest.fn(() => ({ seconds: Date.now() / 1000 })),
    Timestamp: {
      now: jest.fn(() => ({ toMillis: () => Date.now() })),
    },
    FirestoreError,
  };
});

// Mock retry queue service
jest.mock('@/services/retryQueueService', () => ({
  RetryQueue: {
    getInstance: jest.fn(() => ({
      enqueue: jest.fn(),
      registerProcessor: jest.fn(),
    })),
  },
}));

// Mock conversation service
jest.mock('@/services/conversationService', () => ({
  updateConversationLastMessage: jest.fn(),
  checkConversationExists: jest.fn(() => Promise.resolve(true)),
  createConversationWithFirstMessage: jest.fn(),
}));

describe('Message Delivery Status Logic', () => {
  let mockDb: any;
  let mockRetryQueue: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock Firestore database
    mockDb = {
      collection: jest.fn(),
    };
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);

    // Setup mock retry queue
    mockRetryQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      registerProcessor: jest.fn(),
    };
    (RetryQueue.getInstance as jest.Mock).mockReturnValue(mockRetryQueue);
  });

  describe('markMessageAsDelivered', () => {
    it('should update message status to delivered when message exists and status is sending', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageRef = { id: messageId };
      const mockMessageSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          status: 'sending',
          text: 'Hello',
          senderId: 'user456',
        })),
      };

      (doc as jest.Mock).mockReturnValue(mockMessageRef);
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // Act
      await markMessageAsDelivered(conversationId, messageId);

      // Assert
      expect(doc).toHaveBeenCalledWith(mockDb, 'conversations', conversationId, 'messages', messageId);
      expect(getDoc).toHaveBeenCalledWith(mockMessageRef);
      expect(updateDoc).toHaveBeenCalledWith(mockMessageRef, {
        status: 'delivered',
      });
    });

    it('should be idempotent - skip update if already delivered', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          status: 'delivered', // Already delivered
          text: 'Hello',
        })),
      };

      (doc as jest.Mock).mockReturnValue({ id: messageId });
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);

      // Act
      await markMessageAsDelivered(conversationId, messageId);

      // Assert
      expect(updateDoc).not.toHaveBeenCalled(); // Should skip update
    });

    it('should be idempotent - skip update if already read', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          status: 'read', // Already read
          text: 'Hello',
        })),
      };

      (doc as jest.Mock).mockReturnValue({ id: messageId });
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);

      // Act
      await markMessageAsDelivered(conversationId, messageId);

      // Assert
      expect(updateDoc).not.toHaveBeenCalled(); // Should skip update to prevent downgrade
    });

    it('should handle missing message gracefully (sequencing)', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageSnap = {
        exists: jest.fn(() => false), // Message doesn't exist
      };

      (doc as jest.Mock).mockReturnValue({ id: messageId });
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);

      // Act
      await markMessageAsDelivered(conversationId, messageId);

      // Assert
      expect(updateDoc).not.toHaveBeenCalled(); // Should skip update
      // Should not throw error - handles race condition gracefully
    });

    it('should queue update for retry on network error', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          status: 'sending',
        })),
      };

      // Create a proper FirestoreError mock
      const { FirestoreError } = require('firebase/firestore');
      const networkError = new FirestoreError('unavailable', 'Network unavailable');

      (doc as jest.Mock).mockReturnValue({ id: messageId });
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);
      (updateDoc as jest.Mock).mockRejectedValue(networkError);

      // Act
      await markMessageAsDelivered(conversationId, messageId);

      // Assert
      expect(mockRetryQueue.enqueue).toHaveBeenCalledWith({
        operationType: 'STATUS_UPDATE',
        data: expect.objectContaining({
          conversationId,
          messageId,
          status: 'delivered',
        }),
      });
    });

    it('should throw error on permission denied (not queue for retry)', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          status: 'sending',
        })),
      };

      // Create a proper FirestoreError mock
      const { FirestoreError } = require('firebase/firestore');
      const permissionError = new FirestoreError('permission-denied', 'Permission denied');

      (doc as jest.Mock).mockReturnValue({ id: messageId });
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);
      (updateDoc as jest.Mock).mockRejectedValue(permissionError);

      // Act & Assert
      await expect(markMessageAsDelivered(conversationId, messageId)).rejects.toThrow(
        'Permission denied'
      );
      expect(mockRetryQueue.enqueue).not.toHaveBeenCalled(); // Should NOT queue permission errors
    });
  });

  describe('sendMessage - delivery status integration', () => {
    it('should set initial status to sending', async () => {
      // Arrange
      const mockMessageRef = { id: 'msg123' };
      const mockCollectionRef = {};

      (collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { updateConversationLastMessage } = require('@/services/conversationService');
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      // Act
      await sendMessage(
        {
          conversationId: 'conv123',
          senderId: 'user123',
          text: 'Hello',
        },
        ['user123', 'user456']
      );

      // Assert - addDoc should be called with status='sending'
      expect(addDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          status: 'sending',
          text: 'Hello',
          senderId: 'user123',
        })
      );
    });

    it('should update status to delivered after Firestore write confirms', async () => {
      // Arrange
      const mockMessageRef = { id: 'msg123' };
      const mockCollectionRef = {};

      (collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { updateConversationLastMessage } = require('@/services/conversationService');
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await sendMessage(
        {
          conversationId: 'conv123',
          senderId: 'user123',
          text: 'Hello',
        },
        ['user123', 'user456']
      );

      // Assert - updateDoc should be called to set status='delivered'
      expect(updateDoc).toHaveBeenCalledWith(mockMessageRef, {
        status: 'delivered',
      });

      // Assert - returned message should have 'delivered' status
      expect(result.status).toBe('delivered');
    });

    it('should handle network failures with retry logic', async () => {
      // Arrange
      const mockCollectionRef = {};
      (collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (addDoc as jest.Mock).mockRejectedValue({
        code: 'unavailable',
        message: 'Network unavailable',
      });

      // Act & Assert
      await expect(
        sendMessage(
          {
            conversationId: 'conv123',
            senderId: 'user123',
            text: 'Hello',
          },
          ['user123', 'user456']
        )
      ).rejects.toThrow();
    });
  });

  describe('Offline scenarios', () => {
    it('should queue delivery status update when offline', async () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg123';
      const mockMessageSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({
          status: 'sending',
        })),
      };

      // Create a proper FirestoreError mock for offline scenario
      const { FirestoreError } = require('firebase/firestore');
      const offlineError = new FirestoreError('unavailable', 'Offline');

      (doc as jest.Mock).mockReturnValue({ id: messageId });
      (getDoc as jest.Mock).mockResolvedValue(mockMessageSnap);
      (updateDoc as jest.Mock).mockRejectedValue(offlineError);

      // Act
      await markMessageAsDelivered(conversationId, messageId);

      // Assert - Should queue for retry
      expect(mockRetryQueue.enqueue).toHaveBeenCalledWith({
        operationType: 'STATUS_UPDATE',
        data: expect.objectContaining({
          conversationId,
          messageId,
          status: 'delivered',
        }),
      });
    });
  });
});
