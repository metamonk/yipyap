/**
 * Integration tests for Story 3.3: Read Receipts System
 * Tests end-to-end read receipt functionality including:
 * - Recipient views message triggers read receipt
 * - Sender sees status update in real-time
 * - User preference prevents read receipts
 * - Offline scenarios with retry queue
 *
 * @module tests/integration/read-receipts
 */

import { markMessageAsRead } from '@/services/messageService';
import { RetryQueue } from '@/services/retryQueueService';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/app');
jest.mock('firebase/firestore');

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {},
    })
  ),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('Story 3.3: Read Receipts Integration', () => {
  let db: any;
  let retryQueue: RetryQueue;
  let unsubscribers: Unsubscribe[] = [];

  const senderId = 'sender-user-123';
  const recipientId = 'recipient-user-456';
  const conversationId = 'test-conversation-1';
  const messageId = 'test-message-1';

  beforeAll(() => {
    // Initialize Firebase with test project
    const app = initializeApp({
      projectId: 'test-project-read-receipts',
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
    });

    db = getFirestore(app);

    // Connect to Firestore emulator if available
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  });

  beforeEach(async () => {
    // Reset RetryQueue singleton
    // @ts-expect-error - Testing requires resetting singleton instances
    RetryQueue.instance = undefined;
    retryQueue = RetryQueue.getInstance();

    // Clear any persisted data
    await AsyncStorage.clear();
    await retryQueue.clear();

    // Reset mocks
    jest.clearAllMocks();

    // Setup default network state as online
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {},
    });

    // Create test user documents with read receipt preferences
    await setDoc(doc(db, 'users', senderId), {
      uid: senderId,
      username: 'sender',
      displayName: 'Sender User',
      settings: {
        sendReadReceipts: true,
        notificationsEnabled: true,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await setDoc(doc(db, 'users', recipientId), {
      uid: recipientId,
      username: 'recipient',
      displayName: 'Recipient User',
      settings: {
        sendReadReceipts: true,
        notificationsEnabled: true,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Create test conversation
    await setDoc(doc(db, 'conversations', conversationId), {
      participantIds: [senderId, recipientId],
      type: 'direct',
      lastMessageTimestamp: Timestamp.now(),
    });

    // Create test message (delivered but not read)
    await setDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
      id: messageId,
      conversationId,
      senderId,
      text: 'Hello, this is a test message',
      status: 'delivered',
      readBy: [senderId], // Sender already in readBy
      timestamp: Timestamp.now(),
      metadata: { aiProcessed: false },
    });
  });

  afterEach(async () => {
    // Cleanup listeners
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers = [];

    // Note: RetryQueue singleton is reset in beforeEach
  });

  describe('AC1: Recipient views message triggers read receipt', () => {
    it('should mark message as read when recipient views it', async () => {
      // Act: Recipient marks message as read
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Assert: Message status updated to 'read'
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      expect(messageData?.status).toBe('read');
      expect(messageData?.readBy).toContain(recipientId);
      expect(messageData?.readBy).toContain(senderId);
    });

    it('should not mark message as read if already read', async () => {
      // Setup: Message already read
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        status: 'read',
        readBy: [senderId, recipientId],
      });

      // Track update calls
      const initialSnap = await getDoc(messageRef);
      const initialTimestamp = initialSnap.data()?.timestamp;

      // Act: Attempt to mark as read again
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Assert: No changes (idempotency)
      const finalSnap = await getDoc(messageRef);
      expect(finalSnap.data()?.timestamp).toEqual(initialTimestamp);
    });

    it('should not mark own messages as read', async () => {
      // Act: Sender tries to mark their own message as read
      await markMessageAsRead(conversationId, messageId, senderId);

      // Assert: Message still delivered (not marked as read by sender)
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      expect(messageData?.status).toBe('delivered'); // Still delivered
    });

    it('should only mark delivered messages (not sending)', async () => {
      // Setup: Message in 'sending' status
      const sendingMessageId = 'test-message-sending';
      await setDoc(doc(db, 'conversations', conversationId, 'messages', sendingMessageId), {
        id: sendingMessageId,
        conversationId,
        senderId,
        text: 'Message still sending',
        status: 'sending',
        readBy: [senderId],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      });

      // Act: Attempt to mark as read
      await markMessageAsRead(conversationId, sendingMessageId, recipientId);

      // Assert: Status unchanged (still sending)
      const messageRef = doc(db, 'conversations', conversationId, 'messages', sendingMessageId);
      const messageSnap = await getDoc(messageRef);
      expect(messageSnap.data()?.status).toBe('sending');
    });
  });

  describe('AC4: Real-time status updates for sender', () => {
    it('should notify sender when message is marked as read', async () => {
      // Setup: Subscribe to message updates
      const statusUpdates: string[] = [];
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      const unsubscribe = onSnapshot(messageRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.status) {
          statusUpdates.push(data.status);
        }
      });
      unsubscribers.push(unsubscribe);

      // Wait for initial snapshot
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act: Recipient marks message as read
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Wait for real-time update
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Assert: Sender received status update
      expect(statusUpdates).toContain('delivered'); // Initial state
      expect(statusUpdates).toContain('read'); // Updated state
    });
  });

  describe('AC6: User preference prevents read receipts', () => {
    it('should not send read receipt when preference disabled', async () => {
      // Setup: Disable read receipts for recipient
      await updateDoc(doc(db, 'users', recipientId), {
        'settings.sendReadReceipts': false,
      });

      // Act: Recipient views message
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Assert: Message still delivered (not marked as read)
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      expect(messageData?.status).toBe('delivered'); // Not updated to 'read'
      expect(messageData?.readBy).not.toContain(recipientId);
    });

    it('should still send read receipt when preference enabled (default)', async () => {
      // Setup: Ensure preference is enabled (already set in beforeEach)

      // Act: Recipient views message
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Assert: Message marked as read
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      expect(messageData?.status).toBe('read');
      expect(messageData?.readBy).toContain(recipientId);
    });
  });

  describe('Offline scenarios with retry queue', () => {
    it('should queue read receipt update when offline', async () => {
      // Setup: Simulate offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: {},
      });

      // Mock Firestore error for offline scenario
      jest.spyOn(require('firebase/firestore'), 'updateDoc').mockRejectedValueOnce(
        new Error('Network unavailable')
      );

      // Act: Attempt to mark message as read while offline
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Assert: Operation queued for retry
      expect(retryQueue.getQueueSize()).toBeGreaterThan(0);
      const queueItems = retryQueue.getQueueItems();
      expect(queueItems[0].operationType).toBe('READ_RECEIPT');
      expect(queueItems[0].data.messageId).toBe(messageId);

      // Restore mock
      jest.restoreAllMocks();
    });

    it('should process queued read receipt when coming online', async () => {
      // Setup: Start offline
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: {},
      });

      // Mock initial failure
      const updateDocSpy = jest.spyOn(require('firebase/firestore'), 'updateDoc');
      updateDocSpy.mockRejectedValueOnce(new Error('Network unavailable'));

      // Act: Attempt to mark as read while offline
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Verify queued
      expect(retryQueue.getQueueSize()).toBe(1);

      // Simulate coming online
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: {},
      });

      // Restore updateDoc to allow successful retry
      updateDocSpy.mockRestore();

      // Process retry queue
      await retryQueue.processQueue();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Assert: Queue processed, message marked as read
      expect(retryQueue.getQueueSize()).toBe(0);

      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      expect(messageData?.status).toBe('read');
      expect(messageData?.readBy).toContain(recipientId);
    });
  });

  describe('AC7: Group chat read receipts', () => {
    it('should track multiple readers in readBy array', async () => {
      const thirdUserId = 'third-user-789';

      // Setup: Add third user to conversation and user document
      await updateDoc(doc(db, 'conversations', conversationId), {
        participantIds: [senderId, recipientId, thirdUserId],
        type: 'group',
      });

      await setDoc(doc(db, 'users', thirdUserId), {
        uid: thirdUserId,
        username: 'thirduser',
        displayName: 'Third User',
        settings: {
          sendReadReceipts: true,
          notificationsEnabled: true,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Act: Recipient marks as read
      await markMessageAsRead(conversationId, messageId, recipientId);

      // Wait for update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act: Third user marks as read
      await markMessageAsRead(conversationId, messageId, thirdUserId);

      // Wait for update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Both users in readBy array
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      expect(messageData?.status).toBe('read');
      expect(messageData?.readBy).toContain(senderId); // Original sender
      expect(messageData?.readBy).toContain(recipientId); // First reader
      expect(messageData?.readBy).toContain(thirdUserId); // Second reader
      expect(messageData?.readBy).toHaveLength(3);
    });
  });

  describe('AC8: Read receipt fires only once per message (idempotency)', () => {
    it('should not create duplicate read receipts', async () => {
      // Act: Mark as read multiple times rapidly
      await Promise.all([
        markMessageAsRead(conversationId, messageId, recipientId),
        markMessageAsRead(conversationId, messageId, recipientId),
        markMessageAsRead(conversationId, messageId, recipientId),
      ]);

      // Wait for all updates
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Assert: Recipient only appears once in readBy array
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      const messageData = messageSnap.data();

      const recipientCount = messageData?.readBy.filter(
        (id: string) => id === recipientId
      ).length;

      expect(recipientCount).toBe(1); // Only one occurrence
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent message gracefully', async () => {
      const nonExistentMessageId = 'non-existent-message';

      // Act: Attempt to mark non-existent message as read
      await expect(
        markMessageAsRead(conversationId, nonExistentMessageId, recipientId)
      ).resolves.not.toThrow();

      // Assert: No crash, operation completes silently
    });

    it('should handle non-existent user gracefully', async () => {
      const nonExistentUserId = 'non-existent-user';

      // Act: Attempt to mark message as read with non-existent user
      await expect(
        markMessageAsRead(conversationId, messageId, nonExistentUserId)
      ).resolves.not.toThrow();

      // Assert: Message not updated (user doesn't exist, no preference to check)
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      expect(messageSnap.data()?.status).toBe('delivered');
    });
  });
});
