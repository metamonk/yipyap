/**
 * Integration tests for conversation deletion flow
 * @module tests/integration/conversation-delete
 *
 * @remarks
 * These tests verify the complete delete flow including:
 * - Soft deletion via deleteConversation service
 * - Real-time updates via subscribeToConversations
 * - Messages persisting for other participants
 * - Deleted conversations excluded from queries
 * - Deletion taking precedence over archiving
 */

import {
  deleteConversation,
  createConversation,
  subscribeToConversations,
  subscribeToArchivedConversations,
  archiveConversation,
} from '@/services/conversationService';
import { createMessage } from '@/services/messageService';
import { getFirebaseDb } from '@/services/firebase';
import { collection, doc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';

// These tests require Firebase emulators
describe('Conversation Delete Integration Tests', () => {
  const db = getFirebaseDb();
  const testUser1 = 'test-delete-user-1';
  const testUser2 = 'test-delete-user-2';
  const testUser3 = 'test-delete-user-3';
  let testConversationId: string;

  beforeEach(async () => {
    // Create a test conversation before each test
    const conversation = await createConversation({
      type: 'direct',
      participantIds: [testUser1, testUser2],
    });
    testConversationId = conversation.id;
  });

  afterEach(async () => {
    // Cleanup: Delete test conversations
    try {
      const conversationRef = doc(db, 'conversations', testConversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (conversationDoc.exists()) {
        // Delete messages subcollection
        const messagesRef = collection(db, 'conversations', testConversationId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        await Promise.all(messagesSnapshot.docs.map((doc) => deleteDoc(doc.ref)));

        // Delete conversation document
        await deleteDoc(conversationRef);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Soft Delete Behavior', () => {
    it('should set deletedBy.userId to true without deleting conversation document', async () => {
      // Delete conversation for user1
      await deleteConversation(testConversationId, testUser1);

      // Verify conversation document still exists
      const conversationRef = doc(db, 'conversations', testConversationId);
      const conversationDoc = await getDoc(conversationRef);

      expect(conversationDoc.exists()).toBe(true);

      // Verify deletedBy field is set for user1
      const data = conversationDoc.data();
      expect(data?.deletedBy[testUser1]).toBe(true);

      // Verify deletedBy field is NOT set for user2
      expect(data?.deletedBy[testUser2]).toBe(false);
    });

    it('should preserve messages in subcollection after deletion', async () => {
      // Create test message
      await createMessage({
        conversationId: testConversationId,
        senderId: testUser1,
        text: 'Test message that should persist',
      });

      // Delete conversation for user1
      await deleteConversation(testConversationId, testUser1);

      // Verify messages still exist
      const messagesRef = collection(db, 'conversations', testConversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);

      expect(messagesSnapshot.empty).toBe(false);
      expect(messagesSnapshot.size).toBeGreaterThan(0);
    });
  });

  describe('Real-time Query Filtering', () => {
    it('should exclude deleted conversation from subscribeToConversations', (done) => {
      const conversationsBeforeDelete: string[] = [];
      const conversationsAfterDelete: string[] = [];
      let callCount = 0;

      const unsubscribe = subscribeToConversations(testUser1, (conversations) => {
        callCount++;

        if (callCount === 1) {
          // First callback: conversation should be visible
          conversationsBeforeDelete.push(...conversations.map((c) => c.id));
          expect(conversationsBeforeDelete).toContain(testConversationId);

          // Now delete the conversation
          deleteConversation(testConversationId, testUser1).catch(done);
        } else if (callCount === 2) {
          // Second callback: conversation should be hidden
          conversationsAfterDelete.push(...conversations.map((c) => c.id));
          expect(conversationsAfterDelete).not.toContain(testConversationId);

          unsubscribe();
          done();
        }
      });
    });

    it('should still show conversation for other participant after deletion', (done) => {
      let user1Called = false;

      // Subscribe both users
      const unsubscribe1 = subscribeToConversations(testUser1, (conversations) => {
        user1Called = true;

        // Delete for user1
        if (conversations.some((c) => c.id === testConversationId)) {
          deleteConversation(testConversationId, testUser1).catch(done);
        }
      });

      const unsubscribe2 = subscribeToConversations(testUser2, (conversations) => {
        // After user1 deletes, user2 should still see it
        if (user1Called) {
          expect(conversations.some((c) => c.id === testConversationId)).toBe(true);

          unsubscribe1();
          unsubscribe2();
          done();
        }
      });
    });
  });

  describe('Deletion with Archiving', () => {
    it('should exclude deleted conversations from archived list', async () => {
      // Archive the conversation first
      await archiveConversation(testConversationId, testUser1, true);

      // Then delete it
      await deleteConversation(testConversationId, testUser1);

      // Subscribe to archived conversations
      return new Promise<void>((resolve, reject) => {
        const unsubscribe = subscribeToArchivedConversations(testUser1, (archivedConversations) => {
          try {
            // Deleted conversations should not appear in archived list
            expect(archivedConversations.some((c) => c.id === testConversationId)).toBe(false);

            unsubscribe();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    });

    it('should verify deletion takes precedence over archiving', async () => {
      // Archive conversation for user1
      await archiveConversation(testConversationId, testUser1, true);

      // Verify it appears in archived list
      let appearsInArchived = false;
      const unsubscribe1 = subscribeToArchivedConversations(testUser1, (conversations) => {
        appearsInArchived = conversations.some((c) => c.id === testConversationId);
        unsubscribe1();
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(appearsInArchived).toBe(true);

      // Now delete the conversation
      await deleteConversation(testConversationId, testUser1);

      // Verify it no longer appears in archived list
      return new Promise<void>((resolve, reject) => {
        const unsubscribe2 = subscribeToArchivedConversations(
          testUser1,
          (archivedConversations) => {
            try {
              // Should not appear because deleted takes precedence
              expect(archivedConversations.some((c) => c.id === testConversationId)).toBe(false);

              unsubscribe2();
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });
  });

  describe('Group Conversation Deletion', () => {
    let groupConversationId: string;

    beforeEach(async () => {
      // Create a group conversation
      const groupConversation = await createConversation({
        type: 'group',
        participantIds: [testUser1, testUser2, testUser3],
        groupName: 'Test Group',
        creatorId: testUser1,
      });
      groupConversationId = groupConversation.id;
    });

    afterEach(async () => {
      // Cleanup group conversation
      try {
        const conversationRef = doc(db, 'conversations', groupConversationId);
        const conversationDoc = await getDoc(conversationRef);

        if (conversationDoc.exists()) {
          const messagesRef = collection(db, 'conversations', groupConversationId, 'messages');
          const messagesSnapshot = await getDocs(messagesRef);
          await Promise.all(messagesSnapshot.docs.map((doc) => deleteDoc(doc.ref)));
          await deleteDoc(conversationRef);
        }
      } catch (error) {
        console.error('Group cleanup error:', error);
      }
    });

    it('should allow individual participants to delete group conversation', async () => {
      // User1 deletes the group conversation
      await deleteConversation(groupConversationId, testUser1);

      // Verify conversation document still exists
      const conversationRef = doc(db, 'conversations', groupConversationId);
      const conversationDoc = await getDoc(conversationRef);
      expect(conversationDoc.exists()).toBe(true);

      // Verify deletedBy field is set for user1 only
      const data = conversationDoc.data();
      expect(data?.deletedBy[testUser1]).toBe(true);
      expect(data?.deletedBy[testUser2]).toBe(false);
      expect(data?.deletedBy[testUser3]).toBe(false);
    });

    it('should maintain group conversation for non-deleting participants', (done) => {
      // Subscribe user2 to conversations
      const unsubscribe = subscribeToConversations(testUser2, (conversations) => {
        const hasGroupConversation = conversations.some((c) => c.id === groupConversationId);

        if (hasGroupConversation) {
          // User1 deletes, but user2 should still see it
          deleteConversation(groupConversationId, testUser1)
            .then(() => {
              // Give time for real-time update
              setTimeout(() => {
                subscribeToConversations(testUser2, (updatedConversations) => {
                  expect(updatedConversations.some((c) => c.id === groupConversationId)).toBe(true);

                  unsubscribe();
                  done();
                });
              }, 500);
            })
            .catch(done);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when non-participant tries to delete', async () => {
      const nonParticipant = 'non-participant-user';

      await expect(deleteConversation(testConversationId, nonParticipant)).rejects.toThrow(
        'You must be a participant in this conversation to delete it.'
      );
    });

    it('should throw error when conversation does not exist', async () => {
      const nonExistentId = 'non-existent-conversation';

      await expect(deleteConversation(nonExistentId, testUser1)).rejects.toThrow(
        'Conversation not found.'
      );
    });
  });
});
