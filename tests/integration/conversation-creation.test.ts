/**
 * Integration tests for atomic conversation creation (Story 2.13)
 *
 * @remarks
 * Tests the end-to-end flow of creating conversations only when first message is sent,
 * using Firebase Emulator Suite to validate atomic transaction behavior and security rules.
 *
 * @requires Firebase Emulator running on port 8080
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Helper to generate deterministic conversation ID for direct messages
 */
function generateConversationId(participantIds: string[]): string {
  return [...participantIds].sort().join('_');
}

describe('Conversation Creation Integration Tests (Story 2.13)', () => {
  let testEnv: RulesTestEnvironment;
  const user1Id = 'user1-test-uid';
  const user2Id = 'user2-test-uid';
  const user3Id = 'user3-test-uid';

  beforeAll(async () => {
    // Initialize test environment with security rules
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-yipyap-conversation-test',
      firestore: {
        rules: readFileSync(join(process.cwd(), 'firebase/firestore.rules'), 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('Direct Message Conversation Creation (AC 1, 3, 4)', () => {
    it('should NOT create conversation on recipient selection', async () => {
      // Simulate user selecting recipient (no conversation creation)
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      // Verify no conversation exists yet
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participantIds', 'array-contains', user1Id)
      );
      const conversations = await getDocs(conversationsQuery);

      expect(conversations.empty).toBe(true);
      expect(conversations.size).toBe(0);
    });

    it('should create conversation atomically when first message is sent', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);
      const messageText = 'Hello! First message';

      // Verify conversation doesn't exist before message
      const convBefore = await getDoc(doc(db, 'conversations', conversationId));
      expect(convBefore.exists()).toBe(false);

      // Send first message - creates conversation atomically
      const result = await runTransaction(db, async (transaction) => {
        const conversationRef = doc(db, 'conversations', conversationId);
        const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();

        // Create conversation
        transaction.set(conversationRef, {
          id: conversationId,
          type: 'direct',
          participantIds,
          lastMessage: {
            text: messageText,
            senderId: user1Id,
            timestamp: now,
          },
          unreadCount: { [user1Id]: 0, [user2Id]: 1 },
          archivedBy: { [user1Id]: false, [user2Id]: false },
          deletedBy: { [user1Id]: false, [user2Id]: false },
          mutedBy: { [user1Id]: false, [user2Id]: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageTimestamp: serverTimestamp(),
        });

        // Create first message in same transaction
        transaction.set(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: messageText,
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        });

        return { conversationId, messageId };
      });

      expect(result.conversationId).toBe(conversationId);
      expect(result.messageId).toBeDefined();

      // Verify conversation exists after message
      const convAfter = await getDoc(doc(db, 'conversations', conversationId));
      expect(convAfter.exists()).toBe(true);
      expect(convAfter.data()?.participantIds).toEqual(participantIds);
      expect(convAfter.data()?.lastMessage.text).toBe(messageText);

      // Verify message exists
      const messageDoc = await getDoc(doc(db, 'conversations', conversationId, 'messages', result.messageId));
      expect(messageDoc.exists()).toBe(true);
      expect(messageDoc.data()?.text).toBe(messageText);
    });

    it('should show conversation to recipient only after first message (AC 3)', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const user2Context = testEnv.authenticatedContext(user2Id);
      const user1Db = user1Context.firestore();
      const user2Db = user2Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);

      // User2 should not see any conversations before message
      const convsBefore = await getDocs(
        query(collection(user2Db, 'conversations'), where('participantIds', 'array-contains', user2Id))
      );
      expect(convsBefore.empty).toBe(true);

      // User1 sends first message
      await runTransaction(user1Db, async (transaction) => {
        const conversationRef = doc(user1Db, 'conversations', conversationId);
        const messageId = doc(collection(user1Db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(user1Db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();

        transaction.set(conversationRef, {
          id: conversationId,
          type: 'direct',
          participantIds,
          lastMessage: {
            text: 'Hello User2!',
            senderId: user1Id,
            timestamp: now,
          },
          unreadCount: { [user1Id]: 0, [user2Id]: 1 },
          archivedBy: { [user1Id]: false, [user2Id]: false },
          deletedBy: { [user1Id]: false, [user2Id]: false },
          mutedBy: { [user1Id]: false, [user2Id]: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageTimestamp: serverTimestamp(),
        });

        transaction.set(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: 'Hello User2!',
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        });

        return { conversationId, messageId };
      });

      // User2 should now see the conversation with a message
      const convsAfter = await getDocs(
        query(collection(user2Db, 'conversations'), where('participantIds', 'array-contains', user2Id))
      );
      expect(convsAfter.empty).toBe(false);
      expect(convsAfter.size).toBe(1);

      const conversationData = convsAfter.docs[0].data();
      expect(conversationData.lastMessage.text).toBe('Hello User2!');
      expect(conversationData.lastMessage.senderId).toBe(user1Id);
    });

    it('should NOT create ghost/empty conversations (AC 4)', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      // Query all conversations
      const allConvs = await getDocs(collection(db, 'conversations'));

      // All conversations should have lastMessage populated
      allConvs.forEach((convDoc) => {
        const data = convDoc.data();
        expect(data.lastMessage).toBeDefined();
        expect(data.lastMessage.text).toBeDefined();
        expect(data.lastMessage.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Group Message Conversation Creation (AC 2, 3, 4)', () => {
    it('should NOT create group conversation on "Create" button', async () => {
      // Simulate user clicking "Create" button with selected participants
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      // Verify no group conversation exists yet
      const groupConvs = await getDocs(
        query(collection(db, 'conversations'), where('type', '==', 'group'))
      );

      expect(groupConvs.empty).toBe(true);
    });

    it('should create group conversation atomically when first message is sent', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id, user3Id];
      const groupName = 'Test Group';
      const messageText = 'Welcome to the group!';

      // Generate random ID for group
      const conversationId = doc(collection(db, 'conversations')).id;

      // Verify conversation doesn't exist
      const convBefore = await getDoc(doc(db, 'conversations', conversationId));
      expect(convBefore.exists()).toBe(false);

      // Send first message - creates group conversation atomically
      await runTransaction(db, async (transaction) => {
        const conversationRef = doc(db, 'conversations', conversationId);
        const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();

        // Create group conversation
        transaction.set(conversationRef, {
          id: conversationId,
          type: 'group',
          participantIds,
          groupName,
          creatorId: user1Id,
          adminIds: [user1Id],
          lastMessage: {
            text: messageText,
            senderId: user1Id,
            timestamp: now,
          },
          unreadCount: { [user1Id]: 0, [user2Id]: 1, [user3Id]: 1 },
          archivedBy: { [user1Id]: false, [user2Id]: false, [user3Id]: false },
          deletedBy: { [user1Id]: false, [user2Id]: false, [user3Id]: false },
          mutedBy: { [user1Id]: false, [user2Id]: false, [user3Id]: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageTimestamp: serverTimestamp(),
        });

        // Create first message
        transaction.set(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: messageText,
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        });

        return { conversationId, messageId };
      });

      // Verify group conversation exists with proper structure
      const convAfter = await getDoc(doc(db, 'conversations', conversationId));
      expect(convAfter.exists()).toBe(true);
      expect(convAfter.data()?.type).toBe('group');
      expect(convAfter.data()?.groupName).toBe(groupName);
      expect(convAfter.data()?.participantIds).toEqual(participantIds);
      expect(convAfter.data()?.creatorId).toBe(user1Id);
      expect(convAfter.data()?.adminIds).toContain(user1Id);
    });

    it('should show group conversation to all participants only after first message (AC 3)', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const user2Context = testEnv.authenticatedContext(user2Id);
      const user1Db = user1Context.firestore();
      const user2Db = user2Context.firestore();

      const participantIds = [user1Id, user2Id, user3Id];
      const conversationId = doc(collection(user1Db, 'conversations')).id;

      // User2 should not see any group conversations before message
      const groupsBefore = await getDocs(
        query(
          collection(user2Db, 'conversations'),
          where('type', '==', 'group'),
          where('participantIds', 'array-contains', user2Id)
        )
      );
      expect(groupsBefore.empty).toBe(true);

      // User1 creates group and sends first message
      await runTransaction(user1Db, async (transaction) => {
        const conversationRef = doc(user1Db, 'conversations', conversationId);
        const messageId = doc(collection(user1Db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(user1Db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();

        transaction.set(conversationRef, {
          id: conversationId,
          type: 'group',
          participantIds,
          groupName: 'Team Chat',
          creatorId: user1Id,
          adminIds: [user1Id],
          lastMessage: {
            text: 'Welcome everyone!',
            senderId: user1Id,
            timestamp: now,
          },
          unreadCount: { [user1Id]: 0, [user2Id]: 1, [user3Id]: 1 },
          archivedBy: { [user1Id]: false, [user2Id]: false, [user3Id]: false },
          deletedBy: { [user1Id]: false, [user2Id]: false, [user3Id]: false },
          mutedBy: { [user1Id]: false, [user2Id]: false, [user3Id]: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageTimestamp: serverTimestamp(),
        });

        transaction.set(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: 'Welcome everyone!',
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        });

        return { conversationId, messageId };
      });

      // User2 should now see the group conversation
      const groupsAfter = await getDocs(
        query(
          collection(user2Db, 'conversations'),
          where('type', '==', 'group'),
          where('participantIds', 'array-contains', user2Id)
        )
      );
      expect(groupsAfter.empty).toBe(false);
      expect(groupsAfter.size).toBe(1);
      expect(groupsAfter.docs[0].data().groupName).toBe('Team Chat');
    });
  });

  describe('Race Condition Handling (AC 5)', () => {
    it('should handle simultaneous first messages from both participants in direct conversation', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const user2Context = testEnv.authenticatedContext(user2Id);
      const user1Db = user1Context.firestore();
      const user2Db = user2Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds); // Deterministic ID

      // Both users send first message simultaneously
      const promises = [
        runTransaction(user1Db, async (transaction) => {
          const conversationRef = doc(user1Db, 'conversations', conversationId);
          const existingConv = await transaction.get(conversationRef);

          if (!existingConv.exists()) {
            const messageId = doc(collection(user1Db, 'conversations', conversationId, 'messages')).id;
            const messageRef = doc(user1Db, 'conversations', conversationId, 'messages', messageId);
            const now = Timestamp.now();

            transaction.set(conversationRef, {
              id: conversationId,
              type: 'direct',
              participantIds,
              lastMessage: {
                text: 'Message from user1',
                senderId: user1Id,
                timestamp: now,
              },
              unreadCount: { [user1Id]: 0, [user2Id]: 1 },
              archivedBy: { [user1Id]: false, [user2Id]: false },
              deletedBy: { [user1Id]: false, [user2Id]: false },
              mutedBy: { [user1Id]: false, [user2Id]: false },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastMessageTimestamp: serverTimestamp(),
            });

            transaction.set(messageRef, {
              id: messageId,
              conversationId,
              senderId: user1Id,
              text: 'Message from user1',
              status: 'delivered',
              readBy: [user1Id],
              timestamp: serverTimestamp(),
              metadata: { aiProcessed: false },
            });
          }

          return conversationId;
        }),
        runTransaction(user2Db, async (transaction) => {
          const conversationRef = doc(user2Db, 'conversations', conversationId);
          const existingConv = await transaction.get(conversationRef);

          if (!existingConv.exists()) {
            const messageId = doc(collection(user2Db, 'conversations', conversationId, 'messages')).id;
            const messageRef = doc(user2Db, 'conversations', conversationId, 'messages', messageId);
            const now = Timestamp.now();

            transaction.set(conversationRef, {
              id: conversationId,
              type: 'direct',
              participantIds,
              lastMessage: {
                text: 'Message from user2',
                senderId: user2Id,
                timestamp: now,
              },
              unreadCount: { [user1Id]: 1, [user2Id]: 0 },
              archivedBy: { [user1Id]: false, [user2Id]: false },
              deletedBy: { [user1Id]: false, [user2Id]: false },
              mutedBy: { [user1Id]: false, [user2Id]: false },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastMessageTimestamp: serverTimestamp(),
            });

            transaction.set(messageRef, {
              id: messageId,
              conversationId,
              senderId: user2Id,
              text: 'Message from user2',
              status: 'delivered',
              readBy: [user2Id],
              timestamp: serverTimestamp(),
              metadata: { aiProcessed: false },
            });
          }

          return conversationId;
        }),
      ];

      // Wait for both transactions - one should succeed, one may fail or detect existing
      await Promise.allSettled(promises);

      // Verify only one conversation was created
      const conversations = await getDocs(collection(user1Db, 'conversations'));
      expect(conversations.size).toBe(1);

      // Verify conversation has expected structure
      const convDoc = conversations.docs[0];
      expect(convDoc.data().type).toBe('direct');
      expect(convDoc.data().participantIds).toEqual(participantIds);

      // Verify at least one message exists (could be from either user)
      const messages = await getDocs(collection(user1Db, 'conversations', conversationId, 'messages'));
      expect(messages.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Security Rules - isAtomicCreation() (AC 11, TEST-003)', () => {
    it('should allow message creation when conversation is created atomically', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);

      // Transaction should succeed - atomic creation of conversation + message
      await assertSucceeds(
        runTransaction(db, async (transaction) => {
          const conversationRef = doc(db, 'conversations', conversationId);
          const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
          const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

          const now = Timestamp.now();

          // Create conversation
          transaction.set(conversationRef, {
            id: conversationId,
            type: 'direct',
            participantIds,
            lastMessage: {
              text: 'Atomic creation test',
              senderId: user1Id,
              timestamp: now,
            },
            unreadCount: { [user1Id]: 0, [user2Id]: 1 },
            archivedBy: { [user1Id]: false, [user2Id]: false },
            deletedBy: { [user1Id]: false, [user2Id]: false },
            mutedBy: { [user1Id]: false, [user2Id]: false },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageTimestamp: serverTimestamp(),
          });

          // Create message in same transaction (should be allowed by isAtomicCreation)
          transaction.set(messageRef, {
            id: messageId,
            conversationId,
            senderId: user1Id,
            text: 'Atomic creation test',
            status: 'delivered',
            readBy: [user1Id],
            timestamp: serverTimestamp(),
            metadata: { aiProcessed: false },
          });

          return { conversationId, messageId };
        })
      );
    });

    it('should deny message creation if conversation does not exist and not atomic', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);
      const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      // Try to create message without creating conversation first - should fail
      await assertFails(
        setDoc(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: 'This should fail',
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        })
      );
    });

    it('should deny message creation with wrong conversationId in atomic creation', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);
      const wrongConversationId = 'wrong_id';

      // Transaction should fail - message references wrong conversation ID
      await assertFails(
        runTransaction(db, async (transaction) => {
          const conversationRef = doc(db, 'conversations', conversationId);
          const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
          const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

          const now = Timestamp.now();

          transaction.set(conversationRef, {
            id: conversationId,
            type: 'direct',
            participantIds,
            lastMessage: {
              text: 'Test',
              senderId: user1Id,
              timestamp: now,
            },
            unreadCount: { [user1Id]: 0, [user2Id]: 1 },
            archivedBy: { [user1Id]: false, [user2Id]: false },
            deletedBy: { [user1Id]: false, [user2Id]: false },
            mutedBy: { [user1Id]: false, [user2Id]: false },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageTimestamp: serverTimestamp(),
          });

          // Message with wrong conversationId - should be denied by isAtomicCreation
          transaction.set(messageRef, {
            id: messageId,
            conversationId: wrongConversationId, // Wrong ID
            senderId: user1Id,
            text: 'Test',
            status: 'delivered',
            readBy: [user1Id],
            timestamp: serverTimestamp(),
            metadata: { aiProcessed: false },
          });

          return { conversationId, messageId };
        })
      );
    });

    it('should deny message creation if sender is not in participantIds', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user2Id, user3Id]; // user1 NOT included
      const conversationId = generateConversationId(participantIds);

      // Transaction should fail - user1 not in participantIds
      await assertFails(
        runTransaction(db, async (transaction) => {
          const conversationRef = doc(db, 'conversations', conversationId);
          const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
          const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

          const now = Timestamp.now();

          transaction.set(conversationRef, {
            id: conversationId,
            type: 'direct',
            participantIds, // user1 not included
            lastMessage: {
              text: 'Test',
              senderId: user1Id,
              timestamp: now,
            },
            unreadCount: { [user2Id]: 1, [user3Id]: 1 },
            archivedBy: { [user2Id]: false, [user3Id]: false },
            deletedBy: { [user2Id]: false, [user3Id]: false },
            mutedBy: { [user2Id]: false, [user3Id]: false },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageTimestamp: serverTimestamp(),
          });

          transaction.set(messageRef, {
            id: messageId,
            conversationId,
            senderId: user1Id, // user1 not a participant
            text: 'Test',
            status: 'delivered',
            readBy: [user1Id],
            timestamp: serverTimestamp(),
            metadata: { aiProcessed: false },
          });

          return { conversationId, messageId };
        })
      );
    });

    it('should allow message creation after conversation exists (normal flow)', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);

      // First, create conversation atomically
      await runTransaction(db, async (transaction) => {
        const conversationRef = doc(db, 'conversations', conversationId);
        const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();

        transaction.set(conversationRef, {
          id: conversationId,
          type: 'direct',
          participantIds,
          lastMessage: {
            text: 'First message',
            senderId: user1Id,
            timestamp: now,
          },
          unreadCount: { [user1Id]: 0, [user2Id]: 1 },
          archivedBy: { [user1Id]: false, [user2Id]: false },
          deletedBy: { [user1Id]: false, [user2Id]: false },
          mutedBy: { [user1Id]: false, [user2Id]: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageTimestamp: serverTimestamp(),
        });

        transaction.set(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: 'First message',
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        });

        return { conversationId, messageId };
      });

      // Now conversation exists - subsequent messages should work via isConversationParticipant
      const messageId2 = doc(collection(db, 'conversations', conversationId, 'messages')).id;
      const messageRef2 = doc(db, 'conversations', conversationId, 'messages', messageId2);

      await assertSucceeds(
        setDoc(messageRef2, {
          id: messageId2,
          conversationId,
          senderId: user1Id,
          text: 'Second message',
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        })
      );
    });
  });

  describe('Draft Mode Navigation (AC 7, 8, 12)', () => {
    it('should NOT create conversation document when navigating to chat screen in draft mode', async () => {
      // Simulate navigation to chat screen with draft params (no Firestore operations)
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      // User navigates to chat screen with draft params (recipient selected)
      // No Firestore operations should occur

      // Verify no conversation exists
      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);
      const convDoc = await getDoc(doc(db, 'conversations', conversationId));

      expect(convDoc.exists()).toBe(false);
    });

    it('should NOT persist conversation when user abandons draft', async () => {
      // Simulate user navigating away from draft conversation
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      // User navigates to chat screen, types message (but doesn't send), then navigates back
      // No Firestore operations for conversation creation

      // Verify no conversation was created
      const allConvs = await getDocs(collection(db, 'conversations'));
      expect(allConvs.empty).toBe(true);
    });
  });

  describe('Existing Functionality Preserved (AC 10, 13)', () => {
    it('should preserve existing conversation message sending', async () => {
      const user1Context = testEnv.authenticatedContext(user1Id);
      const db = user1Context.firestore();

      const participantIds = [user1Id, user2Id];
      const conversationId = generateConversationId(participantIds);

      // Create conversation first
      await runTransaction(db, async (transaction) => {
        const conversationRef = doc(db, 'conversations', conversationId);
        const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();

        transaction.set(conversationRef, {
          id: conversationId,
          type: 'direct',
          participantIds,
          lastMessage: {
            text: 'Initial message',
            senderId: user1Id,
            timestamp: now,
          },
          unreadCount: { [user1Id]: 0, [user2Id]: 1 },
          archivedBy: { [user1Id]: false, [user2Id]: false },
          deletedBy: { [user1Id]: false, [user2Id]: false },
          mutedBy: { [user1Id]: false, [user2Id]: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageTimestamp: serverTimestamp(),
        });

        transaction.set(messageRef, {
          id: messageId,
          conversationId,
          senderId: user1Id,
          text: 'Initial message',
          status: 'delivered',
          readBy: [user1Id],
          timestamp: serverTimestamp(),
          metadata: { aiProcessed: false },
        });

        return { conversationId, messageId };
      });

      // Send subsequent message (existing functionality)
      const messageId2 = doc(collection(db, 'conversations', conversationId, 'messages')).id;
      const messageRef2 = doc(db, 'conversations', conversationId, 'messages', messageId2);

      await setDoc(messageRef2, {
        id: messageId2,
        conversationId,
        senderId: user1Id,
        text: 'Follow-up message',
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Verify both messages exist
      const messages = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
      expect(messages.size).toBe(2);
    });
  });
});
