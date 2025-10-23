/**
 * Message service for managing chat messages in Firestore
 *
 * @remarks
 * This service handles all message operations including:
 * - Sending messages to conversation subcollections
 * - Fetching messages with cursor-based pagination
 * - Real-time message subscriptions with onSnapshot
 * Never access Firestore directly from components - always use this service layer.
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  FirestoreError,
  Unsubscribe,
  runTransaction,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { Message, CreateMessageInput } from '@/types/models';
import { updateConversationLastMessage, checkConversationExists, createConversationWithFirstMessage } from './conversationService';
import { RetryQueue, RetryQueueItem } from './retryQueueService';

/**
 * Optional parameters for creating a conversation if it doesn't exist
 *
 * @remarks
 * Used when sending the first message to a draft conversation.
 * If provided, the conversation will be created atomically with the message.
 */
export interface DraftConversationParams {
  /** Type of conversation to create */
  type: 'direct' | 'group';

  /** Group name (required for group conversations) */
  groupName?: string;

  /** Group photo URL (optional for group conversations) */
  groupPhotoURL?: string;
}

/**
 * Sends a message to a conversation
 *
 * @param input - Message creation data (conversationId, senderId, text)
 * @param participantIds - Array of participant IDs in the conversation (for updating unread counts)
 * @param draftParams - Optional parameters for creating conversation if it doesn't exist (for draft conversations)
 * @returns Promise resolving to the created message with server-assigned ID and timestamp
 * @throws {Error} When validation fails or Firestore write fails
 *
 * @remarks
 * - Creates message in `/conversations/{conversationId}/messages` subcollection
 * - Automatically updates parent conversation's lastMessage and lastMessageTimestamp
 * - Initializes message with 'sending' status and AI metadata (aiProcessed: false)
 * - Text must be between 1-1000 characters
 * - If conversation doesn't exist and draftParams provided, creates conversation atomically with first message
 * - Preserves existing retry queue integration for failed operations
 *
 * @example
 * ```typescript
 * // Send message to existing conversation
 * const message = await sendMessage(
 *   {
 *     conversationId: 'user123_user456',
 *     senderId: 'user123',
 *     text: 'Hello, how are you?'
 *   },
 *   ['user123', 'user456']
 * );
 *
 * // Send first message to draft conversation
 * const firstMessage = await sendMessage(
 *   {
 *     conversationId: 'user123_user456',
 *     senderId: 'user123',
 *     text: 'Hello!'
 *   },
 *   ['user123', 'user456'],
 *   { type: 'direct' }
 * );
 * ```
 */
export async function sendMessage(
  input: CreateMessageInput,
  participantIds: string[],
  draftParams?: DraftConversationParams
): Promise<Message> {
  const { conversationId, senderId, text } = input;

  // Validation
  if (!text || text.trim().length === 0) {
    throw new Error('Message text cannot be empty');
  }

  if (text.length > 1000) {
    throw new Error('Message text cannot exceed 1000 characters');
  }

  const db = getFirebaseDb();

  try {
    // Check if conversation exists
    const conversationExists = await checkConversationExists(conversationId);

    // If conversation doesn't exist, create it atomically with the first message
    if (!conversationExists) {
      if (!draftParams) {
        throw new Error('Conversation does not exist. Cannot send message to non-existent conversation.');
      }

      // Create conversation with first message atomically
      try {
        const result = await createConversationWithFirstMessage({
          type: draftParams.type,
          participantIds,
          messageText: text,
          senderId,
          groupName: draftParams.groupName,
          groupPhotoURL: draftParams.groupPhotoURL,
        });

        // Return the created message
        // Note: The message was created in the transaction, we need to fetch it or construct it
        const now = Timestamp.now();
        return {
          id: result.messageId,
          conversationId: result.conversationId,
          senderId,
          text: text.trim(),
          status: 'delivered',
          readBy: [senderId],
          timestamp: now,
          metadata: {
            aiProcessed: false,
          },
        };
      } catch (createError) {
        // Categorize the error
        const errorType = categorizeError(createError);

        // For network errors, queue for retry
        if (errorType === 'network') {
          const retryQueue = RetryQueue.getInstance();
          await retryQueue.enqueue({
            operationType: 'CONVERSATION_CREATE',
            data: {
              type: draftParams.type,
              participantIds,
              messageText: text,
              senderId,
              groupName: draftParams.groupName,
              groupPhotoURL: draftParams.groupPhotoURL,
            },
          });

          // Return optimistic message
          const now = Timestamp.now();
          return {
            id: `temp_${Date.now()}`, // Temporary ID
            conversationId,
            senderId,
            text: text.trim(),
            status: 'sending',
            readBy: [senderId],
            timestamp: now,
            metadata: {
              aiProcessed: false,
            },
          };
        }

        // Re-throw non-network errors
        throw createError;
      }
    }

    // Conversation exists - proceed with normal message sending
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    // Create message document
    const now = Timestamp.now();
    const messageData: Omit<Message, 'id' | 'timestamp'> & {
      timestamp?: unknown;
    } = {
      conversationId,
      senderId,
      text: text.trim(),
      status: 'sending',
      readBy: [senderId], // Sender has read their own message
      metadata: {
        aiProcessed: false,
      },
    };

    // Add message to subcollection
    const messageRef = await addDoc(messagesRef, {
      ...messageData,
      timestamp: serverTimestamp(),
    });

    // Update message status to 'delivered' after successful creation
    await updateDoc(messageRef, {
      status: 'delivered',
    });

    // Update conversation's last message
    await updateConversationLastMessage(
      conversationId,
      {
        text: text.trim(),
        senderId,
        timestamp: now,
      },
      participantIds,
      senderId
    );

    // Return message with ID and timestamp (with delivered status)
    return {
      ...messageData,
      id: messageRef.id,
      timestamp: now,
      status: 'delivered', // Return with updated status
    } as Message;
  } catch (error) {
    console.error('Error sending message:', error);

    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }

    // Handle Firestore errors
    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You must be a participant in this conversation.');
    }

    throw new Error('Failed to send message. Please try again.');
  }
}

/**
 * Result of fetching messages with pagination support
 */
export interface GetMessagesResult {
  /** Array of messages ordered by timestamp (descending) */
  messages: Message[];

  /** Last document snapshot for pagination (pass to next getMessages call) */
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;

  /** Whether there are more messages to load */
  hasMore: boolean;
}

/**
 * Fetches messages from a conversation with cursor-based pagination
 *
 * @param conversationId - Conversation ID to fetch messages from
 * @param pageSize - Number of messages to fetch (default: 50)
 * @param lastVisible - Last document from previous page (for pagination)
 * @returns Promise resolving to messages, last document, and hasMore flag
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @remarks
 * - Messages are ordered by timestamp descending (newest first)
 * - Use cursor-based pagination with startAfter for efficient queries
 * - Returns up to `pageSize` messages per call
 * - For initial load, omit `lastVisible` parameter
 * - For subsequent pages, pass `lastDoc` from previous result
 *
 * @example
 * ```typescript
 * // Initial load
 * const result1 = await getMessages('user123_user456', 50);
 * console.log(result1.messages); // First 50 messages
 *
 * // Load next page
 * if (result1.hasMore) {
 *   const result2 = await getMessages('user123_user456', 50, result1.lastDoc);
 *   console.log(result2.messages); // Next 50 messages
 * }
 * ```
 */
export async function getMessages(
  conversationId: string,
  pageSize: number = 50,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null
): Promise<GetMessagesResult> {
  try {
    const db = getFirebaseDb();
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    // Build query with pagination - still query in DESC for efficient pagination
    let q = query(messagesRef, orderBy('timestamp', 'desc'), limit(pageSize));

    if (lastVisible) {
      q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);

    // Map documents to Message type
    const messages: Message[] = [];
    snapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data(),
      } as Message);
    });

    // Reverse messages to get oldest-to-newest order for display
    messages.reverse();

    // Get last document for next pagination
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    // Check if there are more messages
    const hasMore = snapshot.docs.length === pageSize;

    return {
      messages,
      lastDoc,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw new Error('Failed to fetch messages. Please try again.');
  }
}

/**
 * Subscribes to real-time message updates for a conversation
 *
 * @param conversationId - Conversation ID to subscribe to
 * @param callback - Callback function called with new messages on updates
 * @param pageSize - Number of recent messages to subscribe to (default: 50)
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @remarks
 * - Uses Firestore onSnapshot for real-time updates
 * - Callback is invoked immediately with initial messages
 * - Callback is invoked again whenever messages change (new message, update, delete)
 * - Messages are ordered by timestamp descending (newest first)
 * - IMPORTANT: Call the returned unsubscribe function to stop listening (prevent memory leaks)
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToMessages(
 *   'user123_user456',
 *   (messages) => {
 *     console.log(`Received ${messages.length} messages`);
 *     // Update UI with new messages
 *   },
 *   50
 * );
 *
 * // Later, when component unmounts or conversation changes
 * unsubscribe();
 * ```
 */
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void,
  pageSize: number = 50
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    // Query for recent messages
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(pageSize));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages: Message[] = [];
        snapshot.forEach((doc) => {
          messages.push({
            id: doc.id,
            ...doc.data(),
          } as Message);
        });

        // Reverse messages to get oldest-to-newest order for display
        messages.reverse();

        // Invoke callback with updated messages
        callback(messages);
      },
      (error) => {
        console.error('Error in message subscription:', error);
        // Invoke callback with empty array on error
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to messages:', error);
    throw new Error('Failed to subscribe to messages. Please try again.');
  }
}

/**
 * Updates a message's status (e.g., from 'sending' to 'delivered')
 *
 * @param conversationId - Conversation ID
 * @param messageId - Message ID to update
 * @param status - New message status
 * @returns Promise resolving when update is complete
 * @throws {Error} When Firestore update fails
 *
 * @remarks
 * This is typically called to update message delivery status:
 * - 'sending' -> 'delivered' when message is confirmed by server
 * - 'delivered' -> 'read' when recipient reads the message
 *
 * @example
 * ```typescript
 * await updateMessageStatus('user123_user456', 'msg123', 'delivered');
 * ```
 */
export async function updateMessageStatus(
  conversationId: string,
  messageId: string,
  status: 'sending' | 'delivered' | 'read'
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

    await updateDoc(messageRef, {
      status,
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    throw new Error('Failed to update message status. Please try again.');
  }
}

/**
 * Marks a message as delivered when recipient's app receives it
 *
 * @param conversationId - The conversation ID containing the message
 * @param messageId - The message ID to mark as delivered
 * @returns Promise resolving when status update is complete
 * @throws {Error} When user lacks permission or update fails after retries
 *
 * @remarks
 * This function implements sequencing and retry patterns from Story 2.9:
 * - SEQUENCING: Checks if message exists before updating (prevents race conditions)
 * - IDEMPOTENCY: Only updates if current status is 'sending' (prevents downgrading from 'read')
 * - RETRY LOGIC: Retries network failures only (not permission errors)
 * - OFFLINE QUEUE: Queues update when offline for processing when connection restored
 *
 * Called by recipient's app when message is received via Firestore listener.
 * Sender's app marks message as 'delivered' immediately after Firestore write confirms.
 *
 * @example
 * ```typescript
 * // When recipient receives message via listener
 * await markMessageAsDelivered('user123_user456', 'msg123');
 * ```
 */
export async function markMessageAsDelivered(
  conversationId: string,
  messageId: string
): Promise<void> {
  const db = getFirebaseDb();

  try {
    // STEP 1: Sequencing - Check prerequisite (message exists)
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      console.warn(`Message ${messageId} not found, skipping delivery update`);
      return; // Prevent race condition - message hasn't propagated yet
    }

    // STEP 2: Idempotency - Check if already delivered or read
    const currentStatus = messageSnap.data()?.status;
    if (currentStatus === 'delivered' || currentStatus === 'read') {
      return; // Already delivered/read, skip update to prevent downgrade
    }

    // STEP 3: Update status to 'delivered'
    await updateDoc(messageRef, {
      status: 'delivered',
    });
  } catch (error) {
    console.error('Error marking message as delivered:', error);

    // Categorize error for proper handling
    const errorType = categorizeError(error);

    // Don't queue permission errors - these are real security issues
    if (errorType === 'permission') {
      throw new Error('Permission denied. You must be a participant in this conversation.');
    }

    // Queue for retry on network errors
    const retryQueue = RetryQueue.getInstance();
    try {
      await retryQueue.enqueue({
        operationType: 'STATUS_UPDATE',
        data: {
          conversationId,
          messageId,
          status: 'delivered',
          timestamp: Timestamp.now(),
        },
      });

      // Don't throw error - operation is queued for retry
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- Development-only logging
        console.log('Delivery status update queued for retry');
      }
    } catch (queueError) {
      console.error('Failed to queue delivery status update for retry:', queueError);
      throw new Error('Failed to mark message as delivered. Please try again.');
    }
  }
}

/**
 * Marks a message as read by a user
 *
 * @param conversationId - Conversation ID
 * @param messageId - Message ID to mark as read
 * @param userId - User ID marking the message as read
 * @returns Promise resolving when update is complete
 * @throws {Error} When Firestore update fails
 *
 * @remarks
 * Adds the user ID to the message's readBy array if not already present.
 * This is used for read receipts functionality.
 *
 * @example
 * ```typescript
 * await markMessageAsRead('user123_user456', 'msg123', 'user456');
 * ```
 */
/**
 * Marks a message as read when recipient views it in chat view
 *
 * @param conversationId - The ID of the conversation containing the message
 * @param messageId - The ID of the message to mark as read
 * @param userId - The ID of the user marking the message as read
 *
 * @remarks
 * - Respects user's sendReadReceipts privacy preference
 * - Uses sequencing to prevent race conditions (checks status before updating)
 * - Implements idempotency (only updates if not already read)
 * - Does not mark user's own messages as read
 * - Uses arrayUnion for atomic readBy updates
 * - Queues for retry on network failures (not permission errors)
 *
 * @throws {Error} When user lacks permission or network fails
 *
 * @example
 * ```typescript
 * await markMessageAsRead('conv123', 'msg456', 'user789');
 * ```
 */
export async function markMessageAsRead(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> {
  const db = getFirebaseDb();

  try {
    // STEP 1: Check user's read receipt preference (AC6)
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn(`User ${userId} not found, skipping read receipt`);
      return;
    }

    const sendReadReceipts = userSnap.data()?.settings?.sendReadReceipts ?? true;

    // If user disabled read receipts, don't mark as read (AC6)
    if (!sendReadReceipts) {
      return;
    }

    // STEP 2: Sequencing - Check prerequisite (message exists)
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      console.warn(`Message ${messageId} not found, skipping read receipt`);
      return; // Prevent race condition - message hasn't propagated yet
    }

    const message = messageSnap.data();

    // STEP 3: Idempotency - Check if already read
    if (message.status === 'read') {
      return; // Already read, skip update
    }

    // STEP 4: Don't mark own messages as read
    if (message.senderId === userId) {
      return; // Sender already in readBy array on message creation
    }

    // STEP 5: Only mark as read if currently delivered (sequencing)
    if (message.status !== 'delivered') {
      console.warn(`Message ${messageId} status is '${message.status}', not 'delivered' - skipping read receipt`);
      return; // Don't skip the 'delivered' status or downgrade from 'read'
    }

    // STEP 6: Update status to 'read' and add user to readBy array (AC3)
    await updateDoc(messageRef, {
      status: 'read',
      readBy: arrayUnion(userId), // Atomic array update
    });
  } catch (error) {
    console.error('Error marking message as read:', error);

    // Categorize error for proper handling
    const errorType = categorizeError(error);

    // Don't queue permission errors - these are real security issues
    if (errorType === 'permission') {
      throw new Error('Permission denied. You must be a participant in this conversation.');
    }

    // Queue for retry on network errors (AC9)
    const retryQueue = RetryQueue.getInstance();
    try {
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT',
        data: {
          conversationId,
          messageId,
          userId,
          timestamp: Timestamp.now(),
        },
      });

      // Don't throw error - operation is queued for retry
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- Development-only logging
        console.log('Read receipt update queued for retry');
      }
    } catch (queueError) {
      console.error('Failed to queue read receipt update for retry:', queueError);
      throw new Error('Failed to mark message as read. Please try again.');
    }
  }
}

/**
 * Performance metrics for batch update operations
 */
interface BatchUpdateMetrics {
  startTime: number;
  endTime?: number;
  success: boolean;
  retryCount: number;
  errorType?: string;
}

// Track metrics for monitoring
const batchUpdateMetrics: BatchUpdateMetrics[] = [];

/**
 * Initializes the retry queue for message service operations
 */
function initializeRetryQueue(): void {
  const retryQueue = RetryQueue.getInstance();

  // Register processor for conversation creation with first message
  retryQueue.registerProcessor('CONVERSATION_CREATE', async (item: RetryQueueItem) => {
    const data = item.data as {
      type: 'direct' | 'group';
      participantIds: string[];
      messageText: string;
      senderId: string;
      groupName?: string;
      groupPhotoURL?: string;
    };

    try {
      await createConversationWithFirstMessage({
        type: data.type,
        participantIds: data.participantIds,
        messageText: data.messageText,
        senderId: data.senderId,
        groupName: data.groupName,
        groupPhotoURL: data.groupPhotoURL,
      });
      return true; // Success
    } catch (error) {
      console.error('Conversation creation failed:', error);

      // Categorize error
      const errorType = categorizeError(error);

      // Don't retry permission errors
      if (errorType === 'permission') {
        console.error('Permission denied, not retrying:', error);
        return true; // Mark as "success" to remove from queue
      }

      // Continue retrying for network errors
      return false;
    }
  });

  // Register processor for read receipt batch updates
  retryQueue.registerProcessor('READ_RECEIPT_BATCH', async (item: RetryQueueItem) => {
    const data = item.data as {
      conversationId: string;
      messageIds: string[];
      userId: string;
    };

    try {
      // Try atomic transaction first
      await batchUpdateReadReceiptsWithTransaction(data.conversationId, data.messageIds, data.userId);
      return true; // Success
    } catch (error) {
      console.error('Batch update failed, attempting fallback:', error);

      // Categorize error
      const errorType = categorizeError(error);

      // Don't retry permission errors
      if (errorType === 'permission') {
        console.error('Permission denied, not retrying:', error);
        return true; // Mark as "success" to remove from queue
      }

      // For persistent failures after 3 retries, try individual updates
      if (item.retryCount >= 3) {
        try {
          await fallbackToIndividualUpdates(data.conversationId, data.messageIds, data.userId);
          return true; // Success with fallback
        } catch (fallbackError) {
          console.error('Fallback to individual updates also failed:', fallbackError);
          return false; // Will retry
        }
      }

      return false; // Retry
    }
  });

  // Register processor for delivery status updates
  retryQueue.registerProcessor('STATUS_UPDATE', async (item: RetryQueueItem) => {
    const data = item.data as {
      conversationId: string;
      messageId: string;
      status: 'delivered' | 'read';
    };

    try {
      await updateMessageStatus(data.conversationId, data.messageId, data.status);
      return true; // Success
    } catch (error) {
      console.error('Status update failed:', error);

      // Categorize error
      const errorType = categorizeError(error);

      // Don't retry permission errors
      if (errorType === 'permission') {
        console.error('Permission denied, not retrying:', error);
        return true; // Mark as "success" to remove from queue
      }

      // Continue retrying for network errors
      return false;
    }
  });

  // Register processor for individual read receipt updates
  retryQueue.registerProcessor('READ_RECEIPT', async (item: RetryQueueItem) => {
    const data = item.data as {
      conversationId: string;
      messageId: string;
      userId: string;
    };

    try {
      await markMessageAsRead(data.conversationId, data.messageId, data.userId);
      return true; // Success
    } catch (error) {
      console.error('Read receipt update failed:', error);

      // Categorize error
      const errorType = categorizeError(error);

      // Don't retry permission errors
      if (errorType === 'permission') {
        console.error('Permission denied, not retrying:', error);
        return true; // Mark as "success" to remove from queue
      }

      // Continue retrying for network errors
      return false;
    }
  });
}

// Initialize retry queue when module loads
initializeRetryQueue();

/**
 * Categorizes errors for proper handling
 * @param error - The error to categorize
 * @returns Error category string
 */
function categorizeError(error: unknown): string {
  if (error instanceof FirestoreError) {
    switch (error.code) {
      case 'permission-denied':
      case 'unauthenticated':
        return 'permission';
      case 'unavailable':
      case 'cancelled':
      case 'deadline-exceeded':
        return 'network';
      case 'resource-exhausted':
        return 'quota';
      default:
        return 'unknown';
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('offline')) {
      return 'network';
    }
  }

  return 'unknown';
}

/**
 * Updates read receipts using atomic transaction for consistency
 * @param conversationId - The conversation ID
 * @param messageIds - Array of message IDs to mark as read
 * @param userId - The user marking messages as read
 * @returns Promise that resolves when transaction completes
 */
async function batchUpdateReadReceiptsWithTransaction(
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  const db = getFirebaseDb();

  await runTransaction(db, async (transaction) => {
    // Read all documents first (required for transactions)
    const messageRefs = messageIds.map(id =>
      doc(db, 'conversations', conversationId, 'messages', id)
    );

    const messageDocs = await Promise.all(
      messageRefs.map(ref => transaction.get(ref))
    );

    // Check if all documents exist
    const missingDocs = messageDocs.filter(doc => !doc.exists());
    if (missingDocs.length > 0) {
      console.warn(`${missingDocs.length} messages not found, skipping update`);
    }

    // Update all existing documents in transaction
    messageDocs.forEach((doc, index) => {
      if (doc.exists()) {
        transaction.update(messageRefs[index], {
          readBy: arrayUnion(userId),
          status: 'read',
        });
      }
    });

    // Also update conversation unread count
    const conversationRef = doc(db, 'conversations', conversationId);
    transaction.update(conversationRef, {
      [`unreadCount.${userId}`]: 0,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Fallback to individual updates if batch fails persistently
 * @param conversationId - The conversation ID
 * @param messageIds - Array of message IDs to mark as read
 * @param userId - The user marking messages as read
 * @returns Promise that resolves when all individual updates complete
 */
async function fallbackToIndividualUpdates(
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  const db = getFirebaseDb();

  console.warn(`Falling back to individual updates for ${messageIds.length} messages`);

  const updatePromises = messageIds.map(async (messageId) => {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        readBy: arrayUnion(userId),
        status: 'read',
      });
    } catch (error) {
      console.error(`Failed to update message ${messageId}:`, error);
      // Continue with other messages even if one fails
    }
  });

  // Update conversation unread count separately
  const conversationUpdatePromise = (async () => {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        [`unreadCount.${userId}`]: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to update conversation unread count:', error);
    }
  })();

  await Promise.all([...updatePromises, conversationUpdatePromise]);
}

/**
 * Marks multiple messages as read in batch with retry logic
 * @param conversationId - The conversation ID
 * @param messageIds - Array of message IDs to mark as read
 * @param userId - The user marking messages as read
 * @returns Promise that resolves when all messages are marked
 * @throws {Error} When batch update fails and cannot be queued
 * @example
 * ```typescript
 * await markMessagesAsReadBatch('conv123', ['msg1', 'msg2', 'msg3'], 'user123');
 * ```
 *
 * @remarks
 * Implements sequencing to prevent race conditions:
 * 1. PREREQUISITE CHECK: Verify messages exist before attempting update
 * 2. TRANSACTION: Update only existing messages atomically
 * 3. RETRY: Only for network failures, not race conditions or permission errors
 *
 * - Filters out non-existent messages to prevent race conditions
 * - Uses atomic transactions for consistency
 * - Queues failed updates for retry when network is restored
 * - Permission errors are NOT retried (real security issues)
 *
 * See: docs/architecture/real-time-data-patterns.md
 */
export async function markMessagesAsReadBatch(
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  if (messageIds.length === 0) return;

  // Track performance metrics
  const metric: BatchUpdateMetrics = {
    startTime: Date.now(),
    success: false,
    retryCount: 0,
  };

  try {
    // PREVENTIVE: Filter out messages that don't exist yet (prevent race condition)
    // This sequencing prevents errors when messages haven't propagated yet
    // See: docs/architecture/real-time-data-patterns.md
    const db = getFirebaseDb();

    const existingMessages = await Promise.all(
      messageIds.map(async (id) => {
        const msgRef = doc(db, 'conversations', conversationId, 'messages', id);
        const msgDoc = await getDoc(msgRef);
        return msgDoc.exists() ? id : null;
      })
    );

    const validMessageIds = existingMessages.filter((id): id is string => id !== null);

    if (validMessageIds.length === 0) {
      console.warn('No messages found, skipping batch read receipt update');
      return;
    }

    if (validMessageIds.length < messageIds.length) {
      console.warn(
        `${messageIds.length - validMessageIds.length} messages not found yet, updating only existing messages`
      );
    }

    // NOW retry is appropriate for network failures only
    await batchUpdateReadReceiptsWithTransaction(conversationId, validMessageIds, userId);

    // Success - record metrics
    metric.success = true;
    metric.endTime = Date.now();
    batchUpdateMetrics.push(metric);

  } catch (error) {
    console.error('Error marking messages as read in batch:', error);

    // Record failed metric
    metric.success = false;
    metric.endTime = Date.now();
    metric.errorType = categorizeError(error);
    batchUpdateMetrics.push(metric);

    // Don't queue permission errors - these are real security issues
    if (metric.errorType === 'permission') {
      throw new Error('Permission denied. You must be a participant in this conversation.');
    }

    // Queue for retry only on network errors
    const retryQueue = RetryQueue.getInstance();
    try {
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: {
          conversationId,
          messageIds,
          userId,
          timestamp: Timestamp.now(),
        },
      });

      // Don't throw error - operation is queued for retry
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- Development-only logging
        console.log('Batch update queued for retry');
      }
    } catch (queueError) {
      console.error('Failed to queue batch update for retry:', queueError);
      throw new Error('Failed to mark messages as read. Please try again.');
    }
  }
}

/**
 * Gets performance metrics for batch updates
 * @returns Array of batch update metrics
 * @remarks Used for monitoring and debugging batch update performance
 */
export function getBatchUpdateMetrics(): BatchUpdateMetrics[] {
  return [...batchUpdateMetrics];
}

/**
 * Calculates batch update success rate
 * @returns Success rate as percentage (0-100)
 */
export function getBatchUpdateSuccessRate(): number {
  if (batchUpdateMetrics.length === 0) return 100;

  const successful = batchUpdateMetrics.filter(m => m.success).length;
  return Math.round((successful / batchUpdateMetrics.length) * 100);
}
