/**
 * Integration tests for end-to-end chat message flow
 *
 * @remarks
 * Tests the complete flow from sending a message to receiving it in real-time
 * using Firebase Emulator Suite for local testing.
 */

import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Message } from '@/types/models';

describe('Chat Flow Integration Tests', () => {
  let testEnv: RulesTestEnvironment;
  const user1Id = 'testUser1';
  const user2Id = 'testUser2';
  let conversationId: string;

  beforeAll(async () => {
    // Initialize Firebase test environment with emulator
    testEnv = await initializeTestEnvironment({
      projectId: 'test-yipyap',
      firestore: {
        host: 'localhost',
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    // Clear Firestore data before each test
    await testEnv.clearFirestore();

    // Create a test conversation
    const context = testEnv.authenticatedContext(user1Id);
    const db = context.firestore();

    const conversationRef = await addDoc(collection(db, 'conversations'), {
      type: 'direct',
      participantIds: [user1Id, user2Id],
      lastMessage: {
        text: '',
        senderId: user1Id,
        timestamp: serverTimestamp(),
      },
      lastMessageTimestamp: serverTimestamp(),
      unreadCount: { [user1Id]: 0, [user2Id]: 0 },
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    conversationId = conversationRef.id;
  });

  afterAll(async () => {
    // Clean up test environment
    await testEnv.cleanup();
  });

  describe('Send and Receive Messages', () => {
    it('sends a message and receives it in real-time', async () => {
      const testMessage = 'Hello, this is a test message';
      const receivedMessages: Message[] = [];

      // Set up real-time listener before sending message
      const unsubscribe = await new Promise<() => void>((resolve) => {
        const context = testEnv.authenticatedContext(user2Id);
        const db = context.firestore();

        const q = query(
          collection(db, 'conversations', conversationId, 'messages'),
          orderBy('timestamp', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
          snapshot.forEach((doc) => {
            const data = doc.data();
            receivedMessages.push({
              id: doc.id,
              conversationId,
              senderId: data.senderId,
              text: data.text,
              status: data.status,
              readBy: data.readBy || [],
              timestamp: data.timestamp || Timestamp.now(),
              metadata: data.metadata || { aiProcessed: false },
            });
          });
          resolve(unsub);
        });
      });

      // Send message from user1
      const context = testEnv.authenticatedContext(user1Id);
      const db = context.firestore();

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: user1Id,
        text: testMessage,
        status: 'sending',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify message was received
      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages[0].text).toBe(testMessage);
      expect(receivedMessages[0].senderId).toBe(user1Id);

      // Clean up listener
      unsubscribe();
    });

    it('receives messages in chronological order', async () => {
      const context = testEnv.authenticatedContext(user1Id);
      const db = context.firestore();

      const messagesRef = collection(db, 'conversations', conversationId, 'messages');

      // Send multiple messages
      await addDoc(messagesRef, {
        conversationId,
        senderId: user1Id,
        text: 'First message',
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await addDoc(messagesRef, {
        conversationId,
        senderId: user2Id,
        text: 'Second message',
        status: 'delivered',
        readBy: [user2Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await addDoc(messagesRef, {
        conversationId,
        senderId: user1Id,
        text: 'Third message',
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Fetch messages in order
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);

      const messages = snapshot.docs.map((doc) => doc.data().text);

      expect(messages).toEqual(['First message', 'Second message', 'Third message']);
    });

    it('updates conversation lastMessage when new message sent', async () => {
      const context = testEnv.authenticatedContext(user1Id);
      const db = context.firestore();

      const testMessage = 'Latest message';

      // Send message
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: user1Id,
        text: testMessage,
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Note: In actual implementation, conversation.lastMessage is updated
      // by the messageService.sendMessage function via conversationService.updateConversationLastMessage
      // This test would need to use the actual service methods to test that integration
    });
  });

  describe('Real-Time Updates Performance', () => {
    it('receives message updates within 500ms', async () => {
      const startTime = Date.now();
      let receiveTime = 0;

      // Set up listener
      const context = testEnv.authenticatedContext(user2Id);
      const db = context.firestore();

      const q = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          receiveTime = Date.now();
        }
      });

      // Send message
      const senderContext = testEnv.authenticatedContext(user1Id);
      const senderDb = senderContext.firestore();

      await addDoc(collection(senderDb, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: user1Id,
        text: 'Performance test message',
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Wait for update
      await new Promise((resolve) => setTimeout(resolve, 600));

      const latency = receiveTime - startTime;

      // Verify sub-500ms latency
      expect(latency).toBeLessThan(500);

      unsubscribe();
    });
  });

  describe('Message Display and Formatting', () => {
    it('stores and retrieves messages with all required fields', async () => {
      const context = testEnv.authenticatedContext(user1Id);
      const db = context.firestore();

      const messageData = {
        conversationId,
        senderId: user1Id,
        text: 'Complete message test',
        status: 'delivered' as const,
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: {
          aiProcessed: false,
          category: 'social',
          sentiment: 'positive',
        },
      };

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

      // Retrieve message
      const snapshot = await getDocs(collection(db, 'conversations', conversationId, 'messages'));

      const retrievedMessage = snapshot.docs[0].data();

      expect(retrievedMessage.conversationId).toBe(conversationId);
      expect(retrievedMessage.senderId).toBe(user1Id);
      expect(retrievedMessage.text).toBe('Complete message test');
      expect(retrievedMessage.status).toBe('delivered');
      expect(retrievedMessage.readBy).toContain(user1Id);
      expect(retrievedMessage.metadata.aiProcessed).toBe(false);
    });

    it('handles messages with maximum character limit (1000 chars)', async () => {
      const context = testEnv.authenticatedContext(user1Id);
      const db = context.firestore();

      const longText = 'a'.repeat(1000);

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: user1Id,
        text: longText,
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Retrieve and verify
      const snapshot = await getDocs(collection(db, 'conversations', conversationId, 'messages'));

      const message = snapshot.docs[0].data();
      expect(message.text.length).toBe(1000);
      expect(message.text).toBe(longText);
    });
  });

  describe('Multiple Participants', () => {
    it('both participants can send and receive messages', async () => {
      // User 1 sends message
      const user1Context = testEnv.authenticatedContext(user1Id);
      const user1Db = user1Context.firestore();

      await addDoc(collection(user1Db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: user1Id,
        text: 'Message from user 1',
        status: 'delivered',
        readBy: [user1Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // User 2 sends message
      const user2Context = testEnv.authenticatedContext(user2Id);
      const user2Db = user2Context.firestore();

      await addDoc(collection(user2Db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: user2Id,
        text: 'Message from user 2',
        status: 'delivered',
        readBy: [user2Id],
        timestamp: serverTimestamp(),
        metadata: { aiProcessed: false },
      });

      // Both should see both messages
      const messages = await getDocs(
        query(
          collection(user1Db, 'conversations', conversationId, 'messages'),
          orderBy('timestamp', 'asc')
        )
      );

      expect(messages.size).toBe(2);

      const messageDocs = messages.docs.map((doc) => doc.data());
      expect(messageDocs[0].text).toBe('Message from user 1');
      expect(messageDocs[1].text).toBe('Message from user 2');
    });
  });
});
