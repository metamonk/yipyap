/**
 * Conversation service for managing chat conversations in Firestore
 *
 * @remarks
 * This service handles all conversation CRUD operations including:
 * - Deterministic conversation ID generation for 1:1 chats
 * - Creating direct and group conversations
 * - Fetching user conversations with real-time queries
 * Never access Firestore directly from components - always use this service layer.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
  FirestoreError,
  increment,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { Conversation, CreateConversationInput } from '@/types/models';

/**
 * Generates a deterministic conversation ID for 1:1 direct chats
 *
 * @param participantIds - Array of exactly 2 user UIDs
 * @returns Conversation ID (sorted UIDs joined with underscore)
 * @throws {Error} When participantIds array doesn't contain exactly 2 IDs
 *
 * @remarks
 * For direct chats, the same conversation ID is generated regardless of which
 * participant creates it. This prevents duplicate conversations between the same users.
 * Participant IDs are sorted alphabetically before joining to ensure consistency.
 *
 * @example
 * ```typescript
 * // Both calls generate the same ID
 * const id1 = generateConversationId(['user456', 'user123']);
 * const id2 = generateConversationId(['user123', 'user456']);
 * // Both return: 'user123_user456'
 * ```
 */
export function generateConversationId(participantIds: string[]): string {
  if (participantIds.length !== 2) {
    throw new Error('Direct conversation requires exactly 2 participants');
  }

  return participantIds.sort().join('_');
}

/**
 * Creates a new conversation in Firestore
 *
 * @param input - Conversation creation data (type, participants, group details)
 * @returns Promise resolving to the created conversation with server-assigned timestamps
 * @throws {Error} When validation fails or Firestore write fails
 *
 * @remarks
 * - For direct chats: Uses deterministic ID (prevents duplicates)
 * - For group chats: Uses Firestore auto-generated ID
 * - Group name is required for group conversations
 * - Initializes all per-user maps (unreadCount, archivedBy, etc.) to empty
 *
 * @example
 * ```typescript
 * // Create a direct conversation
 * const directChat = await createConversation({
 *   type: 'direct',
 *   participantIds: ['user123', 'user456']
 * });
 *
 * // Create a group conversation
 * const groupChat = await createConversation({
 *   type: 'group',
 *   participantIds: ['user123', 'user456', 'user789'],
 *   groupName: 'Project Team',
 *   creatorId: 'user123'
 * });
 * ```
 */
export async function createConversation(input: CreateConversationInput): Promise<Conversation> {
  const { type, participantIds, groupName, groupPhotoURL, creatorId } = input;

  // Validation
  if (participantIds.length < 2) {
    throw new Error('Conversation requires at least 2 participants');
  }

  if (type === 'direct' && participantIds.length !== 2) {
    throw new Error('Direct conversation requires exactly 2 participants');
  }

  if (type === 'group' && !groupName) {
    throw new Error('Group conversation requires a group name');
  }

  const db = getFirebaseDb();

  try {
    // Generate conversation ID
    let conversationId: string;
    if (type === 'direct') {
      conversationId = generateConversationId(participantIds);
    } else {
      // For group chats, use auto-generated ID
      conversationId = doc(collection(db, 'conversations')).id;
    }

    const conversationRef = doc(db, 'conversations', conversationId);

    // Check if direct conversation already exists
    if (type === 'direct') {
      const existingConversation = await getDoc(conversationRef);
      if (existingConversation.exists()) {
        return existingConversation.data() as Conversation;
      }
    }

    // Initialize per-user maps
    const unreadCount: Record<string, number> = {};
    const archivedBy: Record<string, boolean> = {};
    const deletedBy: Record<string, boolean> = {};
    const mutedBy: Record<string, boolean> = {};

    participantIds.forEach((uid) => {
      unreadCount[uid] = 0;
      archivedBy[uid] = false;
      deletedBy[uid] = false;
      mutedBy[uid] = false;
    });

    // Create conversation document
    const now = Timestamp.now();
    const conversationData: Omit<
      Conversation,
      'createdAt' | 'updatedAt' | 'lastMessageTimestamp'
    > & {
      createdAt?: unknown;
      updatedAt?: unknown;
      lastMessageTimestamp?: unknown;
    } = {
      id: conversationId,
      type,
      participantIds,
      ...(groupName && { groupName }),
      ...(groupPhotoURL && { groupPhotoURL }),
      ...(creatorId && { creatorId }),
      lastMessage: {
        text: type === 'group' ? `${groupName} created` : 'Start chatting!',
        senderId: creatorId || participantIds[0],
        timestamp: now,
      },
      unreadCount,
      archivedBy,
      deletedBy,
      mutedBy,
    };

    await setDoc(conversationRef, {
      ...conversationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageTimestamp: serverTimestamp(),
    });

    // Return conversation with timestamps
    return {
      ...conversationData,
      createdAt: now,
      updatedAt: now,
      lastMessageTimestamp: now,
    } as Conversation;
  } catch (error) {
    console.error('Error creating conversation:', error);

    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }

    // Handle Firestore errors
    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. Please ensure you are logged in.');
    }

    throw new Error('Failed to create conversation. Please try again.');
  }
}

/**
 * Fetches a conversation by ID
 *
 * @param conversationId - Unique conversation identifier
 * @returns Promise resolving to conversation or null if not found
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const conversation = await getConversation('user123_user456');
 * if (conversation) {
 *   console.log(conversation.lastMessage.text);
 * }
 * ```
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  try {
    const db = getFirebaseDb();
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);

    if (!conversationDoc.exists()) {
      return null;
    }

    return conversationDoc.data() as Conversation;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation. Please try again.');
  }
}

/**
 * Fetches all conversations for a user, sorted by last message timestamp
 *
 * @param userId - User ID to fetch conversations for
 * @returns Promise resolving to array of conversations (newest first)
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @remarks
 * Uses composite index on participantIds (array-contains) and lastMessageTimestamp (desc).
 * Filters out conversations marked as deleted by the user.
 * Returns conversations ordered by most recent activity first.
 *
 * @example
 * ```typescript
 * const conversations = await getUserConversations('user123');
 * conversations.forEach(conv => {
 *   console.log(`${conv.lastMessage.text} - ${conv.lastMessageTimestamp}`);
 * });
 * ```
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const db = getFirebaseDb();
    const conversationsRef = collection(db, 'conversations');

    // Query conversations where user is a participant, ordered by last message
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const snapshot = await getDocs(q);

    // Filter out deleted conversations and map to Conversation type
    const conversations: Conversation[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Conversation;
      // Only include if not marked as deleted by this user
      if (!data.deletedBy[userId]) {
        conversations.push(data);
      }
    });

    return conversations;
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    throw new Error('Failed to fetch conversations. Please try again.');
  }
}

/**
 * Updates the last message preview in a conversation
 *
 * @param conversationId - Conversation ID to update
 * @param lastMessage - Last message data (text, senderId, timestamp)
 * @param participantIds - Array of participant IDs (for incrementing unread counts)
 * @param senderId - ID of the message sender (to exclude from unread increment)
 * @returns Promise resolving when update is complete
 * @throws {Error} When Firestore update fails
 *
 * @remarks
 * This function is called by the message service when a new message is sent.
 * It updates the conversation's lastMessage, lastMessageTimestamp, and increments
 * unread counts for all participants except the sender.
 *
 * @example
 * ```typescript
 * await updateConversationLastMessage(
 *   'user123_user456',
 *   {
 *     text: 'Hello!',
 *     senderId: 'user123',
 *     timestamp: Timestamp.now()
 *   },
 *   ['user123', 'user456'],
 *   'user123'
 * );
 * ```
 */
export async function updateConversationLastMessage(
  conversationId: string,
  lastMessage: { text: string; senderId: string; timestamp: Timestamp },
  participantIds: string[],
  senderId: string
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const conversationRef = doc(db, 'conversations', conversationId);

    // Increment unread count for all participants except sender
    const unreadCountUpdates: Record<string, ReturnType<typeof increment>> = {};
    for (const participantId of participantIds) {
      if (participantId !== senderId) {
        // Use Firestore's increment to atomically increment unread count
        unreadCountUpdates[`unreadCount.${participantId}`] = increment(1);
      }
    }

    await updateDoc(conversationRef, {
      lastMessage,
      lastMessageTimestamp: lastMessage.timestamp,
      updatedAt: serverTimestamp(),
      ...unreadCountUpdates,
    });
  } catch (error) {
    console.error('Error updating conversation last message:', error);

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'not-found') {
      throw new Error('Conversation not found.');
    }

    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You must be a participant in this conversation.');
    }

    throw new Error('Failed to update conversation. Please try again.');
  }
}

/**
 * Marks all messages in a conversation as read for a user
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID marking messages as read
 * @returns Promise resolving when update is complete
 * @throws {Error} When Firestore update fails
 *
 * @remarks
 * Resets the unread count to 0 for the specified user.
 * Called when user opens/views a conversation.
 *
 * @example
 * ```typescript
 * await markConversationAsRead('user123_user456', 'user123');
 * ```
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const conversationRef = doc(db, 'conversations', conversationId);

    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    throw new Error('Failed to mark conversation as read. Please try again.');
  }
}

/**
 * Subscribes to real-time updates for user conversations
 *
 * @param userId - User ID to fetch conversations for
 * @param callback - Function called with updated conversations array
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @remarks
 * Sets up a real-time listener for all conversations where the user is a participant.
 * The callback is invoked whenever conversations are added, modified, or removed.
 * Filters out conversations marked as deleted by the user.
 * Returns conversations ordered by most recent activity first.
 *
 * IMPORTANT: Call the returned unsubscribe function when the component unmounts
 * to prevent memory leaks.
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToConversations('user123', (conversations) => {
 *   console.log(`User has ${conversations.length} conversations`);
 *   setConversations(conversations);
 * });
 *
 * // Later, when component unmounts
 * unsubscribe();
 * ```
 */
export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const conversationsRef = collection(db, 'conversations');

    // Query conversations where user is a participant, ordered by last message
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageTimestamp', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const conversations: Conversation[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Conversation;
          // Only include if not marked as deleted by this user
          if (!data.deletedBy[userId]) {
            conversations.push(data);
          }
        });

        callback(conversations);
      },
      (error) => {
        console.error('Error in conversation subscription:', error);
        // Pass empty array on error to prevent app crash
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to conversations:', error);
    throw new Error('Failed to subscribe to conversations. Please try again.');
  }
}

/**
 * Checks if a conversation exists in Firestore
 *
 * @param conversationId - Conversation ID to check
 * @returns Promise resolving to true if conversation exists, false otherwise
 * @throws {Error} When Firestore operation fails
 *
 * @remarks
 * Useful for checking if a direct conversation already exists before creating a new one.
 *
 * @example
 * ```typescript
 * const conversationId = generateConversationId(['user123', 'user456']);
 * const exists = await checkConversationExists(conversationId);
 *
 * if (exists) {
 *   // Navigate to existing conversation
 *   router.push(`/(tabs)/conversations/${conversationId}`);
 * } else {
 *   // Create new conversation
 *   await createConversation({ ... });
 * }
 * ```
 */
export async function checkConversationExists(conversationId: string): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);

    return conversationDoc.exists();
  } catch (error) {
    console.error('Error checking conversation existence:', error);
    throw new Error('Failed to check conversation. Please try again.');
  }
}

/**
 * Refreshes conversations for a user (used for pull-to-refresh)
 *
 * @param userId - User ID to refresh conversations for
 * @returns Promise resolving to updated array of conversations
 * @throws {Error} When Firestore operation fails
 *
 * @remarks
 * This is essentially the same as getUserConversations but is provided
 * as a separate function for semantic clarity in pull-to-refresh contexts.
 * Fetches the latest conversations from Firestore, bypassing any caches.
 *
 * @example
 * ```typescript
 * const handleRefresh = async () => {
 *   setRefreshing(true);
 *   try {
 *     const conversations = await refreshConversations(userId);
 *     setConversations(conversations);
 *   } catch (error) {
 *     console.error('Failed to refresh:', error);
 *   } finally {
 *     setRefreshing(false);
 *   }
 * };
 * ```
 */
export async function refreshConversations(userId: string): Promise<Conversation[]> {
  return getUserConversations(userId);
}
