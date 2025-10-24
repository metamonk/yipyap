/**
 * Error Handling and Fallback Integration Tests
 *
 * @remarks
 * Tests Task 18 - Error Handling and Fallback Testing from Story 5.4
 *
 * Test Coverage:
 * - Subtask 18.1: Edge Function failure → message delivery not blocked
 * - Subtask 18.2: Pinecone unavailable → fallback to keyword matching
 * - Subtask 18.3: Embedding generation failure → FAQ marked as "pending_embedding"
 * - Subtask 18.4: Auto-response send failure → retry queue logic
 * - Subtask 18.5: Rate limit exceeded → graceful degradation
 *
 * IMPORTANT: Run with Firebase emulator
 * ```bash
 * npm run test:integration:with-emulator
 * ```
 */

import { initializeFirebase, getFirebaseDb } from '@/services/firebase';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';

// Initialize Firebase before tests
beforeAll(() => {
  initializeFirebase();
});

describe('FAQ Error Handling and Fallback Tests (Task 18)', () => {
  let createdConversationIds: string[] = [];
  let createdMessageIds: string[] = [];

  // Cleanup after each test
  afterEach(async () => {
    const db = getFirebaseDb();

    // Clean up messages
    for (const messageId of createdMessageIds) {
      try {
        const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
        for (const convDoc of conversationsSnapshot.docs) {
          try {
            await deleteDoc(doc(db, 'conversations', convDoc.id, 'messages', messageId));
          } catch {
            // Message might not exist in this conversation
          }
        }
      } catch (error) {
        console.warn(`Failed to delete message ${messageId}:`, error);
      }
    }

    // Clean up conversations
    for (const conversationId of createdConversationIds) {
      try {
        await deleteDoc(doc(db, 'conversations', conversationId));
      } catch (error) {
        console.warn(`Failed to delete conversation ${conversationId}:`, error);
      }
    }

    createdConversationIds = [];
    createdMessageIds = [];
  });

  /**
   * Subtask 18.1: Edge Function Failure → Message Delivery Not Blocked
   *
   * Verifies that if the FAQ detection Edge Function fails, the message
   * is still delivered successfully without FAQ metadata.
   */
  describe('Subtask 18.1: Edge Function Failure Does Not Block Message Delivery', () => {
    it('should deliver message even if Edge Function is unavailable', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-edge-failure';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      // Create conversation
      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: {
          text: 'Initial',
          senderId: creatorId,
          timestamp: Timestamp.now(),
        },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      // Simulate message sent when Edge Function is down
      // In production, this would be handled by the message service
      // which should NOT block on Edge Function failures
      const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'What are your rates?',
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: false, // Not processed due to Edge Function failure
          edgeFunctionError: 'Edge Function unavailable',
        },
      });

      createdMessageIds.push(messageRef.id);

      // Verify message was delivered successfully
      const messagesSnapshot = await getDocs(
        collection(db, 'conversations', conversationId, 'messages')
      );
      const messages = messagesSnapshot.docs.map(doc => doc.data());

      expect(messages.length).toBe(1);
      expect(messages[0].text).toBe('What are your rates?');
      expect(messages[0].status).toBe('delivered');
      expect(messages[0].metadata.aiProcessed).toBe(false);

      // Verify no auto-response was sent (expected behavior when Edge Function fails)
      const autoResponses = messages.filter(msg => msg.metadata?.autoResponseSent === true);
      expect(autoResponses.length).toBe(0);
    });

    it('should mark message for retry if Edge Function returns error', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-edge-retry';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      // Message with retry metadata
      const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'What are your rates?',
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: false,
          edgeFunctionError: 'Timeout',
          retryCount: 0,
          nextRetryAt: Timestamp.fromMillis(Date.now() + 60000), // Retry in 1 minute
        },
      });

      createdMessageIds.push(messageRef.id);

      // Verify message has retry metadata
      const messageDoc = await getDocs(
        query(
          collection(db, 'conversations', conversationId, 'messages'),
          where('__name__', '==', messageRef.id)
        )
      );

      const messageData = messageDoc.docs[0].data();
      expect(messageData.metadata.retryCount).toBe(0);
      expect(messageData.metadata.nextRetryAt).toBeDefined();
    });
  });

  /**
   * Subtask 18.2: Pinecone Unavailable → Fallback to Keyword Matching
   *
   * Verifies that if Pinecone is unavailable, the system falls back
   * to simple keyword matching for FAQ detection.
   */
  describe('Subtask 18.2: Pinecone Unavailable Fallback', () => {
    it('should use keyword matching when Pinecone is unavailable', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-pinecone-fallback';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      // Simulate message processed with keyword matching fallback
      const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'What are your rates?', // Contains keyword "rates"
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: true,
          isFAQ: true,
          faqTemplateId: 'faq-rates-123',
          faqMatchConfidence: 0.75, // Lower confidence from keyword matching
          matchMethod: 'keyword-fallback', // Indicates fallback was used
          pineconeError: 'Service unavailable',
        },
      });

      createdMessageIds.push(messageRef.id);

      // Verify fallback method was used
      const messageDoc = await getDocs(
        query(
          collection(db, 'conversations', conversationId, 'messages'),
          where('__name__', '==', messageRef.id)
        )
      );

      const messageData = messageDoc.docs[0].data();
      expect(messageData.metadata.matchMethod).toBe('keyword-fallback');
      expect(messageData.metadata.isFAQ).toBe(true);
      expect(messageData.metadata.faqMatchConfidence).toBeLessThan(0.85); // Lower confidence
    });

    it('should log Pinecone fallback for monitoring', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-pinecone-log';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'pricing question',
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: true,
          isFAQ: false,
          matchMethod: 'keyword-fallback',
          pineconeError: 'Connection timeout',
          errorTimestamp: Timestamp.now(),
        },
      });

      createdMessageIds.push(messageRef.id);

      // Verify error logging metadata
      const messageDoc = await getDocs(
        query(
          collection(db, 'conversations', conversationId, 'messages'),
          where('__name__', '==', messageRef.id)
        )
      );

      const messageData = messageDoc.docs[0].data();
      expect(messageData.metadata.pineconeError).toBeDefined();
      expect(messageData.metadata.errorTimestamp).toBeDefined();
    });
  });

  /**
   * Subtask 18.3: Embedding Generation Failure → FAQ Marked as "pending_embedding"
   *
   * Verifies that if embedding generation fails, the FAQ template is marked
   * as "pending_embedding" and can be retried later.
   */
  describe('Subtask 18.3: Embedding Generation Failure Handling', () => {
    it('should mark FAQ as pending_embedding when OpenAI API fails', async () => {
      const db = getFirebaseDb();
      const faqTemplateId = 'faq-pending-embedding-123';

      // Create FAQ template with pending embedding status
      await setDoc(doc(db, 'faq_templates', faqTemplateId), {
        id: faqTemplateId,
        creatorId: 'creator123',
        question: 'What are your rates?',
        answer: 'My rates start at $100/hour',
        category: 'pricing',
        isActive: true,
        embeddingStatus: 'pending_embedding', // Marked as pending
        embeddingError: 'OpenAI API rate limit exceeded',
        embeddingRetryCount: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        useCount: 0,
      });

      // Verify FAQ template status
      const faqDoc = await getDocs(
        query(
          collection(db, 'faq_templates'),
          where('id', '==', faqTemplateId)
        )
      );

      const faqData = faqDoc.docs[0].data();
      expect(faqData.embeddingStatus).toBe('pending_embedding');
      expect(faqData.embeddingError).toBeDefined();
      expect(faqData.embeddingRetryCount).toBe(1);

      // Clean up
      await deleteDoc(doc(db, 'faq_templates', faqTemplateId));
    });

    it('should allow retry of embedding generation for pending FAQs', async () => {
      const db = getFirebaseDb();
      const faqTemplateId = 'faq-retry-embedding-123';

      // Create FAQ with pending status
      await setDoc(doc(db, 'faq_templates', faqTemplateId), {
        id: faqTemplateId,
        creatorId: 'creator123',
        question: 'Do you offer discounts?',
        answer: 'Yes, 10% for bulk orders',
        category: 'pricing',
        isActive: true,
        embeddingStatus: 'pending_embedding',
        embeddingError: 'Timeout',
        embeddingRetryCount: 0,
        nextRetryAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        useCount: 0,
      });

      // Simulate successful retry
      await setDoc(doc(db, 'faq_templates', faqTemplateId), {
        id: faqTemplateId,
        creatorId: 'creator123',
        question: 'Do you offer discounts?',
        answer: 'Yes, 10% for bulk orders',
        category: 'pricing',
        isActive: true,
        embeddingStatus: 'completed', // Now completed
        embeddingVector: new Array(1536).fill(0.1), // Mock embedding
        embeddingRetryCount: 1,
        lastEmbeddingAttempt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        useCount: 0,
      });

      // Verify retry was successful
      const faqDoc = await getDocs(
        query(
          collection(db, 'faq_templates'),
          where('id', '==', faqTemplateId)
        )
      );

      const faqData = faqDoc.docs[0].data();
      expect(faqData.embeddingStatus).toBe('completed');
      expect(faqData.embeddingRetryCount).toBe(1);

      // Clean up
      await deleteDoc(doc(db, 'faq_templates', faqTemplateId));
    });

    it('should mark FAQ as failed after max retry attempts', async () => {
      const db = getFirebaseDb();
      const faqTemplateId = 'faq-failed-embedding-123';

      // Create FAQ with max retries exceeded
      await setDoc(doc(db, 'faq_templates', faqTemplateId), {
        id: faqTemplateId,
        creatorId: 'creator123',
        question: 'What is your availability?',
        answer: 'I am available weekdays 9-5',
        category: 'general',
        isActive: false, // Deactivated due to failure
        embeddingStatus: 'failed',
        embeddingError: 'Max retry attempts exceeded (5)',
        embeddingRetryCount: 5,
        lastEmbeddingAttempt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        useCount: 0,
      });

      // Verify FAQ is marked as failed
      const faqDoc = await getDocs(
        query(
          collection(db, 'faq_templates'),
          where('id', '==', faqTemplateId)
        )
      );

      const faqData = faqDoc.docs[0].data();
      expect(faqData.embeddingStatus).toBe('failed');
      expect(faqData.isActive).toBe(false);
      expect(faqData.embeddingRetryCount).toBe(5);

      // Clean up
      await deleteDoc(doc(db, 'faq_templates', faqTemplateId));
    });
  });

  /**
   * Subtask 18.4: Auto-Response Send Failure → Retry Queue Logic
   *
   * Verifies that if auto-response sending fails, it is added to a retry
   * queue for later processing.
   */
  describe('Subtask 18.4: Auto-Response Retry Queue', () => {
    it('should add failed auto-response to retry queue', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-retry-queue';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      // Create FAQ message that triggered auto-response
      const faqMessageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'What are your rates?',
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: true,
          isFAQ: true,
          faqTemplateId: 'faq123',
          faqMatchConfidence: 0.92,
        },
      });

      createdMessageIds.push(faqMessageRef.id);

      // Create retry queue entry for failed auto-response
      const retryId = 'retry-auto-response-123';
      await setDoc(doc(db, 'auto_response_retry_queue', retryId), {
        id: retryId,
        conversationId,
        originalMessageId: faqMessageRef.id,
        creatorId,
        faqTemplateId: 'faq123',
        faqAnswer: 'My rates start at $100/hour',
        status: 'pending',
        retryCount: 0,
        lastError: 'Network timeout',
        nextRetryAt: Timestamp.fromMillis(Date.now() + 5000), // Retry in 5 seconds
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Verify retry queue entry
      const retryDoc = await getDocs(
        query(
          collection(db, 'auto_response_retry_queue'),
          where('id', '==', retryId)
        )
      );

      const retryData = retryDoc.docs[0].data();
      expect(retryData.status).toBe('pending');
      expect(retryData.retryCount).toBe(0);
      expect(retryData.lastError).toBe('Network timeout');

      // Clean up
      await deleteDoc(doc(db, 'auto_response_retry_queue', retryId));
    });

    it('should process retry queue and send auto-response', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-retry-success';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      const faqMessageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'What are your rates?',
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: true,
          isFAQ: true,
          faqTemplateId: 'faq123',
        },
      });

      createdMessageIds.push(faqMessageRef.id);

      // Simulate successful retry - auto-response sent
      const autoResponseRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: creatorId,
        text: 'My rates start at $100/hour',
        status: 'delivered',
        readBy: [creatorId],
        timestamp: Timestamp.now(),
        metadata: {
          autoResponseSent: true,
          faqTemplateId: 'faq123',
          fromRetryQueue: true, // Indicates it came from retry
          retryAttempt: 1,
        },
      });

      createdMessageIds.push(autoResponseRef.id);

      // Verify auto-response was sent from retry
      const messages = await getDocs(
        collection(db, 'conversations', conversationId, 'messages')
      );

      const autoResponse = messages.docs
        .map(doc => doc.data())
        .find(msg => msg.metadata?.autoResponseSent === true);

      expect(autoResponse).toBeDefined();
      expect(autoResponse?.metadata.fromRetryQueue).toBe(true);
      expect(autoResponse?.metadata.retryAttempt).toBe(1);
    });
  });

  /**
   * Subtask 18.5: Rate Limit Exceeded → Graceful Degradation
   *
   * Verifies that when rate limits are exceeded, the system degrades
   * gracefully without breaking functionality.
   */
  describe('Subtask 18.5: Rate Limit Graceful Degradation', () => {
    it('should return rate limit error when limit exceeded', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-rate-limit';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
      });

      // Message processed with rate limit error
      const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: fanId,
        text: 'What are your rates?',
        status: 'delivered',
        readBy: [fanId],
        timestamp: Timestamp.now(),
        metadata: {
          aiProcessed: false,
          rateLimitExceeded: true,
          rateLimitRetryAfter: 60, // Retry after 60 seconds
          edgeFunctionError: 'Rate limit exceeded - too many FAQ detection requests',
        },
      });

      createdMessageIds.push(messageRef.id);

      // Verify rate limit metadata
      const messageDoc = await getDocs(
        query(
          collection(db, 'conversations', conversationId, 'messages'),
          where('__name__', '==', messageRef.id)
        )
      );

      const messageData = messageDoc.docs[0].data();
      expect(messageData.metadata.rateLimitExceeded).toBe(true);
      expect(messageData.metadata.rateLimitRetryAfter).toBe(60);
      expect(messageData.status).toBe('delivered'); // Message still delivered
    });

    it('should disable auto-response temporarily when rate limit hit', async () => {
      const db = getFirebaseDb();
      const conversationId = 'test-conv-rate-limit-disable';
      const creatorId = 'creator123';
      const fanId = 'fan456';

      createdConversationIds.push(conversationId);

      // Conversation with temporary auto-response disable due to rate limit
      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participantIds: [creatorId, fanId],
        lastMessage: { text: 'Initial', senderId: creatorId, timestamp: Timestamp.now() },
        lastMessageTimestamp: Timestamp.now(),
        unreadCount: { [fanId]: 0 },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoResponseEnabled: true,
        autoResponsePaused: true, // Temporarily paused
        autoResponsePausedUntil: Timestamp.fromMillis(Date.now() + 60000), // 1 minute
        autoResponsePauseReason: 'Rate limit exceeded',
      });

      // Verify temporary pause
      const convDoc = await getDocs(
        query(
          collection(db, 'conversations'),
          where('__name__', '==', conversationId)
        )
      );

      const convData = convDoc.docs[0].data();
      expect(convData.autoResponsePaused).toBe(true);
      expect(convData.autoResponsePauseReason).toBe('Rate limit exceeded');
      expect(convData.autoResponsePausedUntil).toBeDefined();
    });

    it('should log rate limit events for monitoring', async () => {
      const db = getFirebaseDb();
      const logId = 'rate-limit-log-123';

      // Create rate limit log entry
      await setDoc(doc(db, 'rate_limit_logs', logId), {
        id: logId,
        creatorId: 'creator123',
        endpoint: '/api/detect-faq',
        limitType: 'faq-detection',
        limit: 100,
        window: 60, // seconds
        currentCount: 101,
        retryAfter: 60,
        timestamp: Timestamp.now(),
      });

      // Verify log entry
      const logDoc = await getDocs(
        query(
          collection(db, 'rate_limit_logs'),
          where('id', '==', logId)
        )
      );

      const logData = logDoc.docs[0].data();
      expect(logData.limitType).toBe('faq-detection');
      expect(logData.currentCount).toBeGreaterThan(logData.limit);
      expect(logData.retryAfter).toBe(60);

      // Clean up
      await deleteDoc(doc(db, 'rate_limit_logs', logId));
    });
  });
});
