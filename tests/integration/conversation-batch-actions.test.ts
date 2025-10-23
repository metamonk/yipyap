/**
 * Integration tests for batch conversation operations (Story 4.7)
 *
 * @remarks
 * Tests batch archive and delete operations with Firebase Emulator Suite.
 * Verifies atomic operations, error handling, and real-time updates.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import {
  batchArchiveConversations,
  batchDeleteConversations,
} from '@/services/conversationService';
import type { Conversation } from '@/types/models';

// Use Firebase Emulator for testing
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

describe('Batch Conversation Operations - Integration Tests (Story 4.7)', () => {
  const db = getFirebaseDb();
  const userId = 'test-user-1';
  const testConversationIds: string[] = [];

  /**
   * Creates a test conversation in Firestore
   */
  const createTestConversation = async (
    id: string,
    participantIds: string[]
  ): Promise<Conversation> => {
    const conversation: Conversation = {
      id,
      type: participantIds.length === 2 ? 'direct' : 'group',
      participantIds,
      groupName: participantIds.length > 2 ? `Test Group ${id}` : undefined,
      lastMessage: {
        text: 'Test message',
        senderId: participantIds[0],
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

    await setDoc(doc(db, 'conversations', id), conversation);
    return conversation;
  };

  beforeEach(async () => {
    // Create test conversations
    testConversationIds.length = 0;
    for (let i = 1; i <= 5; i++) {
      const conversationId = `test-batch-conv-${Date.now()}-${i}`;
      await createTestConversation(conversationId, [userId, `user-${i}`]);
      testConversationIds.push(conversationId);
    }
  });

  afterEach(async () => {
    // Cleanup handled by emulator reset between test runs
  });

  describe('Batch Archive Operations (AC: 5, 7)', () => {
    it('should archive multiple conversations atomically', async () => {
      const conversationsToArchive = testConversationIds.slice(0, 3);

      await batchArchiveConversations(conversationsToArchive, userId, true);

      // Verify all conversations are archived
      for (const conversationId of conversationsToArchive) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;

        expect(data.archivedBy[userId]).toBe(true);
        expect(data.updatedAt).toBeDefined();
      }

      // Verify other conversations are not archived
      const otherConversations = testConversationIds.slice(3);
      for (const conversationId of otherConversations) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;

        expect(data.archivedBy[userId]).toBeUndefined();
      }
    });

    it('should unarchive multiple conversations atomically', async () => {
      const conversationsToToggle = testConversationIds.slice(0, 3);

      // First, archive them
      await batchArchiveConversations(conversationsToToggle, userId, true);

      // Then, unarchive them
      await batchArchiveConversations(conversationsToToggle, userId, false);

      // Verify all conversations are unarchived
      for (const conversationId of conversationsToToggle) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;

        expect(data.archivedBy[userId]).toBe(false);
      }
    });

    it('should update updatedAt timestamp for archived conversations', async () => {
      const conversationId = testConversationIds[0];

      // Get initial timestamp
      const beforeDocRef = doc(db, 'conversations', conversationId);
      const beforeSnap = await getDoc(beforeDocRef);
      const beforeData = beforeSnap.data() as Conversation;
      const beforeTimestamp = beforeData.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await batchArchiveConversations([conversationId], userId, true);

      // Verify timestamp was updated
      const afterDocRef = doc(db, 'conversations', conversationId);
      const afterSnap = await getDoc(afterDocRef);
      const afterData = afterSnap.data() as Conversation;
      const afterTimestamp = afterData.updatedAt;

      expect(afterTimestamp).not.toEqual(beforeTimestamp);
    });

    it('should support archiving conversations for multiple users independently', async () => {
      const conversationId = testConversationIds[0];
      const user1 = 'user-multi-1';
      const user2 = 'user-multi-2';

      // User 1 archives
      await batchArchiveConversations([conversationId], user1, true);

      // Verify only user 1 has archived
      const docRef1 = doc(db, 'conversations', conversationId);
      const docSnap1 = await getDoc(docRef1);
      const data1 = docSnap1.data() as Conversation;

      expect(data1.archivedBy[user1]).toBe(true);
      expect(data1.archivedBy[user2]).toBeUndefined();

      // User 2 archives
      await batchArchiveConversations([conversationId], user2, true);

      // Verify both users have archived
      const docRef2 = doc(db, 'conversations', conversationId);
      const docSnap2 = await getDoc(docRef2);
      const data2 = docSnap2.data() as Conversation;

      expect(data2.archivedBy[user1]).toBe(true);
      expect(data2.archivedBy[user2]).toBe(true);
    });

    it('should handle empty conversation list gracefully', async () => {
      await expect(batchArchiveConversations([], userId, true)).rejects.toThrow(
        'No conversations provided'
      );
    });

    it('should handle batch archive of exactly 500 conversations (Firestore limit)', async () => {
      // Create 500 test conversations
      const largeConversationIds: string[] = [];
      for (let i = 0; i < 500; i++) {
        const conversationId = `test-large-batch-${Date.now()}-${i}`;
        await createTestConversation(conversationId, [userId, `user-${i}`]);
        largeConversationIds.push(conversationId);
      }

      // Should succeed with exactly 500
      await expect(
        batchArchiveConversations(largeConversationIds, userId, true)
      ).resolves.not.toThrow();

      // Cleanup first few for verification
      const sampleIds = largeConversationIds.slice(0, 5);
      for (const conversationId of sampleIds) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;
        expect(data.archivedBy[userId]).toBe(true);
      }
    }, 30000); // Increase timeout for large batch

    it('should reject batch archive with >500 conversations', async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `conv-${i}`);

      await expect(batchArchiveConversations(tooManyIds, userId, true)).rejects.toThrow(
        'exceeds Firestore batch limit'
      );
    });
  });

  describe('Batch Delete Operations (AC: 6, 7)', () => {
    it('should soft-delete multiple conversations atomically', async () => {
      const conversationsToDelete = testConversationIds.slice(0, 3);

      await batchDeleteConversations(conversationsToDelete, userId);

      // Verify all conversations are soft-deleted
      for (const conversationId of conversationsToDelete) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;

        expect(data.deletedBy[userId]).toBe(true);
        expect(data.updatedAt).toBeDefined();
        // Verify document still exists (soft delete, not hard delete)
        expect(docSnap.exists()).toBe(true);
      }
    });

    it('should update updatedAt timestamp for deleted conversations', async () => {
      const conversationId = testConversationIds[0];

      // Get initial timestamp
      const beforeDocRef = doc(db, 'conversations', conversationId);
      const beforeSnap = await getDoc(beforeDocRef);
      const beforeData = beforeSnap.data() as Conversation;
      const beforeTimestamp = beforeData.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await batchDeleteConversations([conversationId], userId);

      // Verify timestamp was updated
      const afterDocRef = doc(db, 'conversations', conversationId);
      const afterSnap = await getDoc(afterDocRef);
      const afterData = afterSnap.data() as Conversation;
      const afterTimestamp = afterData.updatedAt;

      expect(afterTimestamp).not.toEqual(beforeTimestamp);
    });

    it('should preserve conversation data after soft delete', async () => {
      const conversationId = testConversationIds[0];

      // Get conversation data before delete
      const beforeDocRef = doc(db, 'conversations', conversationId);
      const beforeSnap = await getDoc(beforeDocRef);
      const beforeData = beforeSnap.data() as Conversation;

      await batchDeleteConversations([conversationId], userId);

      // Get conversation data after delete
      const afterDocRef = doc(db, 'conversations', conversationId);
      const afterSnap = await getDoc(afterDocRef);
      const afterData = afterSnap.data() as Conversation;

      // Verify data is preserved
      expect(afterData.id).toBe(beforeData.id);
      expect(afterData.participantIds).toEqual(beforeData.participantIds);
      expect(afterData.lastMessage).toEqual(beforeData.lastMessage);
      // Only deletedBy field should change
      expect(afterData.deletedBy[userId]).toBe(true);
    });

    it('should support deleting conversations for multiple users independently', async () => {
      const conversationId = testConversationIds[0];
      const user1 = 'user-multi-1';
      const user2 = 'user-multi-2';

      // User 1 deletes
      await batchDeleteConversations([conversationId], user1);

      // Verify only user 1 has deleted
      const docRef1 = doc(db, 'conversations', conversationId);
      const docSnap1 = await getDoc(docRef1);
      const data1 = docSnap1.data() as Conversation;

      expect(data1.deletedBy[user1]).toBe(true);
      expect(data1.deletedBy[user2]).toBeUndefined();

      // User 2 deletes
      await batchDeleteConversations([conversationId], user2);

      // Verify both users have deleted
      const docRef2 = doc(db, 'conversations', conversationId);
      const docSnap2 = await getDoc(docRef2);
      const data2 = docSnap2.data() as Conversation;

      expect(data2.deletedBy[user1]).toBe(true);
      expect(data2.deletedBy[user2]).toBe(true);
    });

    it('should handle empty conversation list gracefully', async () => {
      await expect(batchDeleteConversations([], userId)).rejects.toThrow(
        'No conversations provided'
      );
    });

    it('should handle batch delete of exactly 500 conversations (Firestore limit)', async () => {
      // Create 500 test conversations
      const largeConversationIds: string[] = [];
      for (let i = 0; i < 500; i++) {
        const conversationId = `test-large-delete-${Date.now()}-${i}`;
        await createTestConversation(conversationId, [userId, `user-${i}`]);
        largeConversationIds.push(conversationId);
      }

      // Should succeed with exactly 500
      await expect(batchDeleteConversations(largeConversationIds, userId)).resolves.not.toThrow();

      // Cleanup first few for verification
      const sampleIds = largeConversationIds.slice(0, 5);
      for (const conversationId of sampleIds) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;
        expect(data.deletedBy[userId]).toBe(true);
      }
    }, 30000); // Increase timeout for large batch

    it('should reject batch delete with >500 conversations', async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => `conv-${i}`);

      await expect(batchDeleteConversations(tooManyIds, userId)).rejects.toThrow(
        'exceeds Firestore batch limit'
      );
    });
  });

  describe('Real-Time Updates (AC: 9)', () => {
    it('should trigger real-time listener when conversations are archived', async () => {
      const conversationId = testConversationIds[0];
      const updates: Conversation[] = [];

      // Set up listener
      const docRef = doc(db, 'conversations', conversationId);
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          updates.push(snapshot.data() as Conversation);
        }
      });

      // Wait for initial snapshot
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Archive the conversation
      await batchArchiveConversations([conversationId], userId, true);

      // Wait for snapshot update
      await new Promise((resolve) => setTimeout(resolve, 500));

      unsubscribe();

      // Verify listener received the update
      expect(updates.length).toBeGreaterThan(0);
      const latestUpdate = updates[updates.length - 1];
      expect(latestUpdate.archivedBy[userId]).toBe(true);
    });

    it('should trigger real-time listener when conversations are deleted', async () => {
      const conversationId = testConversationIds[0];
      const updates: Conversation[] = [];

      // Set up listener
      const docRef = doc(db, 'conversations', conversationId);
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          updates.push(snapshot.data() as Conversation);
        }
      });

      // Wait for initial snapshot
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Delete the conversation
      await batchDeleteConversations([conversationId], userId);

      // Wait for snapshot update
      await new Promise((resolve) => setTimeout(resolve, 500));

      unsubscribe();

      // Verify listener received the update
      expect(updates.length).toBeGreaterThan(0);
      const latestUpdate = updates[updates.length - 1];
      expect(latestUpdate.deletedBy[userId]).toBe(true);
    });

    it('should filter out archived conversations in query', async () => {
      const conversationId = testConversationIds[0];

      // Archive one conversation
      await batchArchiveConversations([conversationId], userId, true);

      // Query for non-archived conversations
      const conversationsRef = collection(db, 'conversations');
      const q = query(conversationsRef, where('participantIds', 'array-contains', userId));

      const querySnapshot = await getDocs(q);
      const nonArchivedConversations: Conversation[] = [];

      querySnapshot.forEach((doc) => {
        const conversation = doc.data() as Conversation;
        if (!conversation.archivedBy[userId]) {
          nonArchivedConversations.push(conversation);
        }
      });

      // Verify archived conversation is filtered out
      const archivedExists = nonArchivedConversations.some((conv) => conv.id === conversationId);
      expect(archivedExists).toBe(false);
    });

    it('should filter out deleted conversations in query', async () => {
      const conversationId = testConversationIds[0];

      // Delete one conversation
      await batchDeleteConversations([conversationId], userId);

      // Query for non-deleted conversations
      const conversationsRef = collection(db, 'conversations');
      const q = query(conversationsRef, where('participantIds', 'array-contains', userId));

      const querySnapshot = await getDocs(q);
      const nonDeletedConversations: Conversation[] = [];

      querySnapshot.forEach((doc) => {
        const conversation = doc.data() as Conversation;
        if (!conversation.deletedBy[userId]) {
          nonDeletedConversations.push(conversation);
        }
      });

      // Verify deleted conversation is filtered out
      const deletedExists = nonDeletedConversations.some((conv) => conv.id === conversationId);
      expect(deletedExists).toBe(false);
    });
  });

  describe('Atomic Operations (AC: 7)', () => {
    it('should complete all updates or none on success', async () => {
      const conversationsToArchive = testConversationIds.slice(0, 3);

      await batchArchiveConversations(conversationsToArchive, userId, true);

      // Verify ALL conversations were archived (atomicity)
      for (const conversationId of conversationsToArchive) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;
        expect(data.archivedBy[userId]).toBe(true);
      }
    });

    it('should complete all deletes or none on success', async () => {
      const conversationsToDelete = testConversationIds.slice(0, 3);

      await batchDeleteConversations(conversationsToDelete, userId);

      // Verify ALL conversations were deleted (atomicity)
      for (const conversationId of conversationsToDelete) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;
        expect(data.deletedBy[userId]).toBe(true);
      }
    });
  });

  describe('Mixed Operations', () => {
    it('should handle archiving and deleting different conversations', async () => {
      const toArchive = testConversationIds.slice(0, 2);
      const toDelete = testConversationIds.slice(2, 4);

      // Archive some
      await batchArchiveConversations(toArchive, userId, true);

      // Delete others
      await batchDeleteConversations(toDelete, userId);

      // Verify archived conversations
      for (const conversationId of toArchive) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;
        expect(data.archivedBy[userId]).toBe(true);
        expect(data.deletedBy[userId]).toBeUndefined();
      }

      // Verify deleted conversations
      for (const conversationId of toDelete) {
        const docRef = doc(db, 'conversations', conversationId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data() as Conversation;
        expect(data.deletedBy[userId]).toBe(true);
        expect(data.archivedBy[userId]).toBeUndefined();
      }
    });

    it('should support archiving already deleted conversations', async () => {
      const conversationId = testConversationIds[0];

      // Delete first
      await batchDeleteConversations([conversationId], userId);

      // Then archive
      await batchArchiveConversations([conversationId], userId, true);

      // Verify both flags are set
      const docRef = doc(db, 'conversations', conversationId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data() as Conversation;

      expect(data.deletedBy[userId]).toBe(true);
      expect(data.archivedBy[userId]).toBe(true);
    });

    it('should support deleting already archived conversations', async () => {
      const conversationId = testConversationIds[0];

      // Archive first
      await batchArchiveConversations([conversationId], userId, true);

      // Then delete
      await batchDeleteConversations([conversationId], userId);

      // Verify both flags are set
      const docRef = doc(db, 'conversations', conversationId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data() as Conversation;

      expect(data.archivedBy[userId]).toBe(true);
      expect(data.deletedBy[userId]).toBe(true);
    });
  });
});
