/**
 * Integration tests for unread count flow
 * @module tests/integration/unread-count
 *
 * @remarks
 * These tests use Firebase Emulator to test the complete unread count flow:
 * - Message sent → unread count increments for recipients
 * - Conversation opened → unread count resets for that user
 * - Multiple users in group → each user's count increments independently
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { sendMessage } from '@/services/messageService';
import { markConversationAsRead } from '@/services/conversationService';
import type { Conversation, CreateMessageInput } from '@/types/models';

// These tests require Firebase Emulator to be running
// Run: firebase emulators:start

describe('Unread Count Integration Tests', () => {
  const db = getFirebaseDb();
  let testConversationId: string;

  beforeEach(async () => {
    // Create a test conversation
    const now = Timestamp.now();
    testConversationId = `test-conv-${Date.now()}`;

    const conversationData: Conversation = {
      id: testConversationId,
      type: 'direct',
      participantIds: ['userA', 'userB'],
      lastMessage: {
        text: '',
        senderId: 'userA',
        timestamp: now,
      },
      lastMessageTimestamp: now,
      unreadCount: {
        userA: 0,
        userB: 0,
      },
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'conversations', testConversationId), conversationData);
  });

  afterEach(async () => {
    // Clean up test data
    try {
      // Delete messages subcollection
      const messagesRef = collection(db, 'conversations', testConversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      for (const messageDoc of messagesSnapshot.docs) {
        await deleteDoc(messageDoc.ref);
      }

      // Delete conversation
      await deleteDoc(doc(db, 'conversations', testConversationId));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Message send increments unread count', () => {
    it('should increment unread count for recipient when message is sent', async () => {
      const messageInput: CreateMessageInput = {
        conversationId: testConversationId,
        senderId: 'userA',
        text: 'Hello, User B!',
      };

      await sendMessage(messageInput, ['userA', 'userB']);

      // Verify conversation unread count
      const conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      const conversation = conversationDoc.data() as Conversation;

      expect(conversation.unreadCount['userA']).toBe(0); // Sender's count not incremented
      expect(conversation.unreadCount['userB']).toBe(1); // Recipient's count incremented
    });

    it('should increment unread count for multiple recipients in group', async () => {
      // Create group conversation
      const groupConversationId = `test-group-${Date.now()}`;
      const now = Timestamp.now();

      const groupData: Conversation = {
        id: groupConversationId,
        type: 'group',
        participantIds: ['user1', 'user2', 'user3', 'user4'],
        groupName: 'Test Group',
        lastMessage: {
          text: '',
          senderId: 'user1',
          timestamp: now,
        },
        lastMessageTimestamp: now,
        unreadCount: {
          user1: 0,
          user2: 0,
          user3: 0,
          user4: 0,
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'conversations', groupConversationId), groupData);

      // Send message from user1
      const messageInput: CreateMessageInput = {
        conversationId: groupConversationId,
        senderId: 'user1',
        text: 'Hello group!',
      };

      await sendMessage(messageInput, ['user1', 'user2', 'user3', 'user4']);

      // Verify all recipients have incremented counts
      const conversationDoc = await getDoc(doc(db, 'conversations', groupConversationId));
      const conversation = conversationDoc.data() as Conversation;

      expect(conversation.unreadCount['user1']).toBe(0); // Sender
      expect(conversation.unreadCount['user2']).toBe(1); // Recipient
      expect(conversation.unreadCount['user3']).toBe(1); // Recipient
      expect(conversation.unreadCount['user4']).toBe(1); // Recipient

      // Cleanup
      await deleteDoc(doc(db, 'conversations', groupConversationId));
    });

    it('should increment unread count multiple times for multiple messages', async () => {
      // Send first message
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Message 1',
        },
        ['userA', 'userB']
      );

      // Send second message
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Message 2',
        },
        ['userA', 'userB']
      );

      // Send third message
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Message 3',
        },
        ['userA', 'userB']
      );

      // Verify recipient's unread count is 3
      const conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      const conversation = conversationDoc.data() as Conversation;

      expect(conversation.unreadCount['userB']).toBe(3);
      expect(conversation.unreadCount['userA']).toBe(0);
    });
  });

  describe('Opening conversation resets unread count', () => {
    it('should reset unread count to 0 when user opens conversation', async () => {
      // Send message to increment count
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Hello!',
        },
        ['userA', 'userB']
      );

      // Verify count is incremented
      let conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      let conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userB']).toBe(1);

      // User B opens conversation
      await markConversationAsRead(testConversationId, 'userB');

      // Verify count is reset to 0
      conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userB']).toBe(0);
    });

    it('should only reset count for specific user, not all participants', async () => {
      // Create group conversation
      const groupConversationId = `test-group-${Date.now()}`;
      const now = Timestamp.now();

      const groupData: Conversation = {
        id: groupConversationId,
        type: 'group',
        participantIds: ['user1', 'user2', 'user3'],
        groupName: 'Test Group',
        lastMessage: {
          text: '',
          senderId: 'user1',
          timestamp: now,
        },
        lastMessageTimestamp: now,
        unreadCount: {
          user1: 0,
          user2: 0,
          user3: 0,
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'conversations', groupConversationId), groupData);

      // Send message from user1
      await sendMessage(
        {
          conversationId: groupConversationId,
          senderId: 'user1',
          text: 'Hello!',
        },
        ['user1', 'user2', 'user3']
      );

      // User2 opens conversation
      await markConversationAsRead(groupConversationId, 'user2');

      // Verify only user2's count is reset
      const conversationDoc = await getDoc(doc(db, 'conversations', groupConversationId));
      const conversation = conversationDoc.data() as Conversation;

      expect(conversation.unreadCount['user1']).toBe(0); // Sender
      expect(conversation.unreadCount['user2']).toBe(0); // Opened conversation
      expect(conversation.unreadCount['user3']).toBe(1); // Hasn't opened yet

      // Cleanup
      await deleteDoc(doc(db, 'conversations', groupConversationId));
    });

    it('should handle resetting count multiple times', async () => {
      // Send message
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Message 1',
        },
        ['userA', 'userB']
      );

      // Reset
      await markConversationAsRead(testConversationId, 'userB');

      // Send another message
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Message 2',
        },
        ['userA', 'userB']
      );

      // Verify count is 1 again
      let conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      let conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userB']).toBe(1);

      // Reset again
      await markConversationAsRead(testConversationId, 'userB');

      // Verify count is 0
      conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userB']).toBe(0);
    });
  });

  describe('Bidirectional messaging', () => {
    it('should correctly track unread counts for both users in conversation', async () => {
      // User A sends message
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userA',
          text: 'Hello from A',
        },
        ['userA', 'userB']
      );

      // Verify User B has unread count 1
      let conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      let conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userA']).toBe(0);
      expect(conversation.unreadCount['userB']).toBe(1);

      // User B sends message (without reading A's message first)
      await sendMessage(
        {
          conversationId: testConversationId,
          senderId: 'userB',
          text: 'Hello from B',
        },
        ['userA', 'userB']
      );

      // Verify User A now has unread count 1, User B still has 1
      conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userA']).toBe(1);
      expect(conversation.unreadCount['userB']).toBe(1);

      // User B opens conversation
      await markConversationAsRead(testConversationId, 'userB');

      // Verify only User B's count is reset
      conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userA']).toBe(1);
      expect(conversation.unreadCount['userB']).toBe(0);

      // User A opens conversation
      await markConversationAsRead(testConversationId, 'userA');

      // Verify both counts are 0
      conversationDoc = await getDoc(doc(db, 'conversations', testConversationId));
      conversation = conversationDoc.data() as Conversation;
      expect(conversation.unreadCount['userA']).toBe(0);
      expect(conversation.unreadCount['userB']).toBe(0);
    });
  });
});
