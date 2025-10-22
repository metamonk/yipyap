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
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { Message, CreateMessageInput } from '@/types/models';
import { updateConversationLastMessage } from './conversationService';

/**
 * Sends a message to a conversation
 *
 * @param input - Message creation data (conversationId, senderId, text)
 * @param participantIds - Array of participant IDs in the conversation (for updating unread counts)
 * @returns Promise resolving to the created message with server-assigned ID and timestamp
 * @throws {Error} When validation fails or Firestore write fails
 *
 * @remarks
 * - Creates message in `/conversations/{conversationId}/messages` subcollection
 * - Automatically updates parent conversation's lastMessage and lastMessageTimestamp
 * - Initializes message with 'sending' status and AI metadata (aiProcessed: false)
 * - Text must be between 1-1000 characters
 *
 * @example
 * ```typescript
 * const message = await sendMessage(
 *   {
 *     conversationId: 'user123_user456',
 *     senderId: 'user123',
 *     text: 'Hello, how are you?'
 *   },
 *   ['user123', 'user456']
 * );
 * ```
 */
export async function sendMessage(
  input: CreateMessageInput,
  participantIds: string[]
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
    const { updateDoc } = await import('firebase/firestore');
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
    const messageRef = collection(db, 'conversations', conversationId, 'messages');
    const { doc: docRef, updateDoc } = await import('firebase/firestore');

    await updateDoc(docRef(messageRef, messageId), {
      status,
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    throw new Error('Failed to update message status. Please try again.');
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
export async function markMessageAsRead(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const messageRef = collection(db, 'conversations', conversationId, 'messages');
    const { doc: docRef, updateDoc, arrayUnion } = await import('firebase/firestore');

    await updateDoc(docRef(messageRef, messageId), {
      readBy: arrayUnion(userId),
      status: 'read',
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw new Error('Failed to mark message as read. Please try again.');
  }
}

/**
 * Marks multiple messages as read in batch
 * @param conversationId - The conversation ID
 * @param messageIds - Array of message IDs to mark as read
 * @param userId - The user marking messages as read
 * @returns Promise that resolves when all messages are marked
 * @throws {Error} When batch update fails
 * @example
 * ```typescript
 * await markMessagesAsReadBatch('conv123', ['msg1', 'msg2', 'msg3'], 'user123');
 * ```
 */
export async function markMessagesAsReadBatch(
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  if (messageIds.length === 0) return;

  try {
    const db = getFirebaseDb();
    const { writeBatch, doc, arrayUnion } = await import('firebase/firestore');
    const batch = writeBatch(db);

    messageIds.forEach((messageId) => {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      batch.update(messageRef, {
        readBy: arrayUnion(userId),
        // Only update status to 'read' - the hook already filters to only messages from others
        status: 'read',
      });
    });

    // Also update conversation unread count
    const conversationRef = doc(db, 'conversations', conversationId);
    batch.update(conversationRef, {
      [`unreadCount.${userId}`]: 0,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking messages as read in batch:', error);
    throw new Error('Failed to mark messages as read. Please try again.');
  }
}
