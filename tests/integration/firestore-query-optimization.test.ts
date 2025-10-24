/**
 * Integration tests for Firestore query optimization
 * Story 4.8: Firestore Query Optimization for Cost Efficiency
 *
 * These tests verify:
 * - Query limits are applied correctly
 * - Pagination works with real Firestore
 * - Client-side filtering behaves correctly
 * - Real-time listeners are scoped appropriately
 *
 * IMPORTANT: Run with Firebase emulator
 * ```bash
 * npm run test:integration:with-emulator
 * ```
 */

import {
  getUserConversations,
  subscribeToConversations,
  createConversation,
} from '@/services/conversationService';
import { getMessages, sendMessage } from '@/services/messageService';
import { initializeFirebase } from '@/services/firebase';
import {
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';

// Initialize Firebase before tests
beforeAll(() => {
  initializeFirebase();
});

describe('Firestore Query Optimization Integration Tests', () => {
  const testUserId1 = 'test-user-optimization-1';
  const testUserId2 = 'test-user-optimization-2';
  let createdConversationIds: string[] = [];

  // Cleanup after each test
  afterEach(async () => {
    // Clean up created conversations
    const db = getFirebaseDb();
    for (const conversationId of createdConversationIds) {
      try {
        await deleteDoc(doc(db, 'conversations', conversationId));
      } catch (error) {
        console.warn(`Failed to delete conversation ${conversationId}:`, error);
      }
    }
    createdConversationIds = [];
  });

  describe('Conversation List Pagination', () => {
    it('should fetch only 30 conversations with default limit', async () => {
      // Create 35 test conversations
      const conversations: string[] = [];
      for (let i = 0; i < 35; i++) {
        const conv = await createConversation({
          type: 'direct',
          participantIds: [testUserId1, `other-user-${i}`],
        });
        conversations.push(conv.id);
        createdConversationIds.push(conv.id);
      }

      // Fetch with default limit (30)
      const result = await getUserConversations(testUserId1);

      // Should fetch exactly 30 conversations
      expect(result.conversations.length).toBe(30);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).not.toBeNull();
    });

    it('should load next page with pagination cursor', async () => {
      // Create 50 test conversations
      for (let i = 0; i < 50; i++) {
        const conv = await createConversation({
          type: 'direct',
          participantIds: [testUserId1, `other-user-${i}`],
        });
        createdConversationIds.push(conv.id);
      }

      // Fetch first page
      const firstPage = await getUserConversations(testUserId1, 30);
      expect(firstPage.conversations.length).toBe(30);
      expect(firstPage.hasMore).toBe(true);

      // Fetch second page using cursor
      const secondPage = await getUserConversations(
        testUserId1,
        30,
        firstPage.lastDoc
      );

      expect(secondPage.conversations.length).toBe(20); // Remaining conversations
      expect(secondPage.hasMore).toBe(false);

      // Ensure no overlap between pages
      const firstPageIds = new Set(firstPage.conversations.map(c => c.id));
      const secondPageIds = new Set(secondPage.conversations.map(c => c.id));
      const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
      expect(intersection.length).toBe(0);
    });

    it('should respect custom page size', async () => {
      // Create 25 test conversations
      for (let i = 0; i < 25; i++) {
        const conv = await createConversation({
          type: 'direct',
          participantIds: [testUserId1, `other-user-${i}`],
        });
        createdConversationIds.push(conv.id);
      }

      // Fetch with custom page size of 10
      const result = await getUserConversations(testUserId1, 10);

      expect(result.conversations.length).toBe(10);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('Real-Time Listener Scoping', () => {
    it('should scope subscription to 30 most recent conversations', (done) => {
      // Create 35 conversations first
      const createConversations = async () => {
        for (let i = 0; i < 35; i++) {
          const conv = await createConversation({
            type: 'direct',
            participantIds: [testUserId2, `other-user-${i}`],
          });
          createdConversationIds.push(conv.id);
        }

        // Subscribe and verify limit
        const unsubscribe = subscribeToConversations(
          testUserId2,
          (conversations) => {
            if (conversations.length > 0) {
              // Should receive at most 30 conversations
              expect(conversations.length).toBeLessThanOrEqual(30);
              unsubscribe();
              done();
            }
          },
          30
        );
      };

      createConversations();
    }, 15000); // Increase timeout for async operations

    it('should filter archived conversations in real-time listener', (done) => {
      const testConversation = async () => {
        // Create conversation
        const conv = await createConversation({
          type: 'direct',
          participantIds: [testUserId2, 'other-user-test'],
        });
        createdConversationIds.push(conv.id);

        let callCount = 0;

        const unsubscribe = subscribeToConversations(
          testUserId2,
          (conversations) => {
            callCount++;

            if (callCount === 1) {
              // First call should include the conversation
              expect(conversations.some(c => c.id === conv.id)).toBe(true);

              // Archive the conversation
              const db = getFirebaseDb();
              const conversationRef = doc(db, 'conversations', conv.id);
              import('firebase/firestore').then(({ updateDoc }) => {
                updateDoc(conversationRef, {
                  [`archivedBy.${testUserId2}`]: true,
                });
              });
            } else if (callCount === 2) {
              // Second call should filter out archived conversation
              expect(conversations.some(c => c.id === conv.id)).toBe(false);
              unsubscribe();
              done();
            }
          },
          30
        );
      };

      testConversation();
    }, 15000);
  });

  describe('Message Pagination Optimization', () => {
    it('should load messages with limit of 50', async () => {
      // Create conversation
      const conv = await createConversation({
        type: 'direct',
        participantIds: [testUserId1, testUserId2],
      });
      createdConversationIds.push(conv.id);

      // Send 60 messages
      for (let i = 0; i < 60; i++) {
        await sendMessage({
          conversationId: conv.id,
          senderId: testUserId1,
          text: `Test message ${i}`,
          participantIds: [testUserId1, testUserId2],
        });
      }

      // Fetch messages with default pagination
      const result = await getMessages(conv.id);

      // Should return 50 messages (default page size)
      expect(result.messages.length).toBe(50);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).not.toBeNull();
    }, 20000); // Longer timeout for many writes

    it('should paginate messages correctly', async () => {
      // Create conversation
      const conv = await createConversation({
        type: 'direct',
        participantIds: [testUserId1, testUserId2],
      });
      createdConversationIds.push(conv.id);

      // Send 75 messages
      for (let i = 0; i < 75; i++) {
        await sendMessage({
          conversationId: conv.id,
          senderId: testUserId1,
          text: `Test message ${i}`,
          participantIds: [testUserId1, testUserId2],
        });
      }

      // Fetch first page
      const firstPage = await getMessages(conv.id, 50);
      expect(firstPage.messages.length).toBe(50);

      // Fetch second page
      const secondPage = await getMessages(conv.id, 50, firstPage.lastDoc);
      expect(secondPage.messages.length).toBe(25);
      expect(secondPage.hasMore).toBe(false);

      // Verify no overlap
      const firstPageIds = new Set(firstPage.messages.map(m => m.id));
      const secondPageIds = new Set(secondPage.messages.map(m => m.id));
      const intersection = [...firstPageIds].filter(id => secondPageIds.has(id));
      expect(intersection.length).toBe(0);
    }, 25000);
  });

  describe('Query Performance Verification', () => {
    it('should complete conversation list query under 1 second', async () => {
      // Create 30 conversations
      for (let i = 0; i < 30; i++) {
        const conv = await createConversation({
          type: 'direct',
          participantIds: [testUserId1, `perf-test-${i}`],
        });
        createdConversationIds.push(conv.id);
      }

      // Measure query time
      const startTime = Date.now();
      const result = await getUserConversations(testUserId1);
      const duration = Date.now() - startTime;

      expect(result.conversations.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should be under 1 second
    }, 10000);

    it('should handle empty results efficiently', async () => {
      const uniqueUserId = `empty-test-user-${Date.now()}`;

      const startTime = Date.now();
      const result = await getUserConversations(uniqueUserId);
      const duration = Date.now() - startTime;

      expect(result.conversations.length).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeNull();
      expect(duration).toBeLessThan(500); // Empty query should be very fast
    });
  });

  describe('Client-Side Filtering', () => {
    it('should filter deleted conversations from results', async () => {
      // Create conversation
      const conv = await createConversation({
        type: 'direct',
        participantIds: [testUserId1, testUserId2],
      });
      createdConversationIds.push(conv.id);

      // Verify it appears in results
      let result = await getUserConversations(testUserId1);
      expect(result.conversations.some(c => c.id === conv.id)).toBe(true);

      // Mark as deleted
      const db = getFirebaseDb();
      const conversationRef = doc(db, 'conversations', conv.id);
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(conversationRef, {
        [`deletedBy.${testUserId1}`]: true,
      });

      // Verify it's filtered out
      result = await getUserConversations(testUserId1);
      expect(result.conversations.some(c => c.id === conv.id)).toBe(false);
    });

    it('should not filter conversations deleted by other users', async () => {
      // Create conversation
      const conv = await createConversation({
        type: 'direct',
        participantIds: [testUserId1, testUserId2],
      });
      createdConversationIds.push(conv.id);

      // Mark as deleted by OTHER user
      const db = getFirebaseDb();
      const conversationRef = doc(db, 'conversations', conv.id);
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(conversationRef, {
        [`deletedBy.${testUserId2}`]: true, // Different user
      });

      // Verify it still appears for testUserId1
      const result = await getUserConversations(testUserId1);
      expect(result.conversations.some(c => c.id === conv.id)).toBe(true);
    });
  });
});
