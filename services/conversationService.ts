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
  runTransaction,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { GROUP_SIZE_LIMIT } from '@/constants/groupLimits';
import type { Conversation, CreateConversationInput, CreateConversationWithMessageParams, CreateConversationResult } from '@/types/models';
import { PerformanceMonitor } from '@/utils/performanceMonitor';

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
  const { type, participantIds, groupName, groupPhotoURL, creatorId, adminIds } = input;

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

  // Validation: Group size limit
  // This client-side validation matches Firebase Security Rules for consistency
  if (type === 'group' && participantIds.length > GROUP_SIZE_LIMIT) {
    throw new Error(
      `Group size limit exceeded. Maximum ${GROUP_SIZE_LIMIT} members allowed, got ${participantIds.length}.`
    );
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

    // For group conversations, initialize adminIds (defaults to creatorId if not provided)
    const groupAdminIds = type === 'group' ? (adminIds || (creatorId ? [creatorId] : [])) : undefined;

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
      ...(groupAdminIds && { adminIds: groupAdminIds }),
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
 * Creates a conversation with its first message atomically using a Firestore transaction
 *
 * @param params - Parameters including conversation type, participants, message text, and sender
 * @returns Promise resolving to object with both conversation ID and message ID
 * @throws {Error} When validation fails or transaction fails
 *
 * @remarks
 * This function ensures that conversations only appear in users' lists when they contain
 * at least one actual message. Both the conversation and message are created together
 * in a single atomic transaction that either fully succeeds or fully fails.
 *
 * Race Condition Handling:
 * - Direct messages: Uses deterministic ID, checks if conversation exists before creating
 * - Group messages: Uses random ID, first creator wins
 *
 * The transaction will automatically retry on conflicts and roll back if any operation fails.
 * This prevents ghost/empty conversations from appearing in conversation lists.
 *
 * @example
 * ```typescript
 * // Create direct conversation with first message
 * const result = await createConversationWithFirstMessage({
 *   type: 'direct',
 *   participantIds: ['user123', 'user456'],
 *   messageText: 'Hello!',
 *   senderId: 'user123'
 * });
 * // result: { conversationId: 'user123_user456', messageId: 'msg_abc123' }
 *
 * // Create group conversation with first message
 * const groupResult = await createConversationWithFirstMessage({
 *   type: 'group',
 *   participantIds: ['user123', 'user456', 'user789'],
 *   messageText: 'Welcome to the team!',
 *   senderId: 'user123',
 *   groupName: 'Project Team'
 * });
 * ```
 */
export async function createConversationWithFirstMessage(
  params: CreateConversationWithMessageParams
): Promise<CreateConversationResult> {
  const { type, participantIds, messageText, senderId, groupName, groupPhotoURL } = params;

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

  if (!messageText || messageText.trim().length === 0) {
    throw new Error('First message text is required');
  }

  if (messageText.length > 1000) {
    throw new Error('Message text must be 1000 characters or less');
  }

  if (!senderId || !participantIds.includes(senderId)) {
    throw new Error('Sender must be one of the conversation participants');
  }

  // Validation: Group size limit
  if (type === 'group' && participantIds.length > GROUP_SIZE_LIMIT) {
    throw new Error(
      `Group size limit exceeded. Maximum ${GROUP_SIZE_LIMIT} members allowed, got ${participantIds.length}.`
    );
  }

  const db = getFirebaseDb();

  // Start performance monitoring
  const monitor = PerformanceMonitor.getInstance();
  const metricId = monitor.startOperation('CONVERSATION_CREATE', 1); // 1 conversation + 1 message

  try {
    // Run atomic transaction
    const result = await runTransaction(db, async (transaction) => {
      // Generate conversation ID
      let conversationId: string;
      if (type === 'direct') {
        // Deterministic ID for direct messages (prevents duplicates)
        conversationId = generateConversationId(participantIds);
      } else {
        // Random ID for group messages
        conversationId = doc(collection(db, 'conversations')).id;
      }

      const conversationRef = doc(db, 'conversations', conversationId);

      // Check if conversation already exists (race condition handling)
      const existingConversation = await transaction.get(conversationRef);
      if (existingConversation.exists()) {
        // Conversation already exists - likely race condition
        // For direct messages, this is expected behavior
        // For groups, first creator wins

        // Still need to create the message from this sender
        const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

        const now = Timestamp.now();
        const messageData = {
          id: messageId,
          conversationId,
          senderId,
          text: messageText.trim(),
          status: 'delivered' as const,
          readBy: [senderId],
          timestamp: serverTimestamp(),
          metadata: {
            aiProcessed: false,
          },
        };

        transaction.set(messageRef, messageData);

        // Update conversation's last message
        transaction.update(conversationRef, {
          lastMessage: {
            text: messageText.trim(),
            senderId,
            timestamp: now,
          },
          lastMessageTimestamp: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Increment unread count for all participants except sender
          ...participantIds.reduce((acc, participantId) => {
            if (participantId !== senderId) {
              acc[`unreadCount.${participantId}`] = increment(1);
            }
            return acc;
          }, {} as Record<string, ReturnType<typeof increment>>),
        });

        return { conversationId, messageId };
      }

      // Conversation doesn't exist - create it atomically with first message

      // Initialize per-user maps
      const unreadCount: Record<string, number> = {};
      const archivedBy: Record<string, boolean> = {};
      const deletedBy: Record<string, boolean> = {};
      const mutedBy: Record<string, boolean> = {};

      participantIds.forEach((uid) => {
        // All participants except sender have 1 unread message
        unreadCount[uid] = uid === senderId ? 0 : 1;
        archivedBy[uid] = false;
        deletedBy[uid] = false;
        mutedBy[uid] = false;
      });

      const now = Timestamp.now();

      // Create conversation document
      const conversationData = {
        id: conversationId,
        type,
        participantIds,
        ...(groupName && { groupName }),
        ...(groupPhotoURL && { groupPhotoURL }),
        ...(type === 'group' && { creatorId: senderId }),
        ...(type === 'group' && { adminIds: [senderId] }), // Creator becomes first admin
        lastMessage: {
          text: messageText.trim(),
          senderId,
          timestamp: now,
        },
        unreadCount,
        archivedBy,
        deletedBy,
        mutedBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageTimestamp: serverTimestamp(),
      };

      transaction.set(conversationRef, conversationData);

      // Create first message
      const messageId = doc(collection(db, 'conversations', conversationId, 'messages')).id;
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

      const messageData = {
        id: messageId,
        conversationId,
        senderId,
        text: messageText.trim(),
        status: 'delivered' as const,
        readBy: [senderId],
        timestamp: serverTimestamp(),
        metadata: {
          aiProcessed: false,
        },
      };

      transaction.set(messageRef, messageData);

      return { conversationId, messageId };
    });

    // End performance monitoring (success)
    monitor.endOperation(metricId, true);

    return result;
  } catch (error) {
    // End performance monitoring (failure)
    monitor.endOperation(metricId, false, error);

    console.error('Error creating conversation with first message:', error);

    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }

    // Handle Firestore errors
    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. Please ensure you are logged in.');
    }

    if (firestoreError.code === 'aborted') {
      throw new Error('Transaction aborted due to conflict. Please try again.');
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
        console.error('[subscribeToConversations] Error in subscription:', error);
        // Pass empty array on error to prevent app crash
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('[subscribeToConversations] Error setting up subscription:', error);
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

/**
 * Checks if a user is an admin of a group conversation
 *
 * @param conversation - The conversation to check
 * @param userId - User ID to check for admin privileges
 * @returns True if user is an admin, false otherwise
 *
 * @remarks
 * For direct conversations, always returns false.
 * For group conversations, checks if userId is in the adminIds array.
 *
 * @example
 * ```typescript
 * const conversation = await getConversation('group123');
 * const isAdmin = isGroupAdmin(conversation, 'user123');
 * if (isAdmin) {
 *   // Show admin controls
 * }
 * ```
 */
export function isGroupAdmin(conversation: Conversation | null, userId: string): boolean {
  if (!conversation || conversation.type !== 'group') {
    return false;
  }

  // Check adminIds array if it exists
  if (conversation.adminIds && conversation.adminIds.length > 0) {
    return conversation.adminIds.includes(userId);
  }

  // Fallback: Check if user is the creator (for backwards compatibility)
  return conversation.creatorId === userId;
}

/**
 * Updates group conversation properties (name, photo)
 *
 * @param conversationId - Conversation ID to update
 * @param updates - Object containing fields to update (groupName, groupPhotoURL)
 * @param userId - User ID making the update (for permission check)
 * @returns Promise resolving when update is complete
 * @throws {Error} When user lacks admin permissions or update fails
 *
 * @remarks
 * Only group admins can update group properties.
 * This function checks permissions before allowing updates.
 *
 * @example
 * ```typescript
 * await updateGroupSettings('group123', {
 *   groupName: 'New Group Name',
 *   groupPhotoURL: 'https://example.com/photo.jpg'
 * }, 'user123');
 * ```
 */
export async function updateGroupSettings(
  conversationId: string,
  updates: { groupName?: string; groupPhotoURL?: string | null },
  userId: string
): Promise<void> {
  try {
    const db = getFirebaseDb();

    // First, check if user is an admin
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only update settings for group conversations.');
    }

    if (!isGroupAdmin(conversation, userId)) {
      throw new Error('Only group admins can update group settings.');
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.groupName !== undefined) {
      updateData.groupName = updates.groupName;
    }

    if (updates.groupPhotoURL !== undefined) {
      updateData.groupPhotoURL = updates.groupPhotoURL;
    }

    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, updateData);
  } catch (error) {
    console.error('Error updating group settings:', error);

    if (error instanceof Error) {
      throw error;
    }

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You must be an admin to update group settings.');
    }

    throw new Error('Failed to update group settings. Please try again.');
  }
}

/**
 * Removes a user from a group conversation (leave group)
 *
 * @param conversationId - Conversation ID to leave
 * @param userId - User ID leaving the group
 * @returns Promise resolving when user is removed
 * @throws {Error} When conversation is not a group or removal fails
 *
 * @remarks
 * - Removes user from participantIds array
 * - If user is the last admin, the next participant becomes admin
 * - If user is the last participant, the conversation is not deleted (kept for history)
 * - Updates all relevant conversation metadata
 *
 * @example
 * ```typescript
 * await leaveGroup('group123', 'user456');
 * // User456 is removed from the group
 * ```
 */
export async function leaveGroup(conversationId: string, userId: string): Promise<void> {
  try {
    const db = getFirebaseDb();

    // Get conversation to check current state
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only leave group conversations.');
    }

    if (!conversation.participantIds.includes(userId)) {
      throw new Error('You are not a member of this group.');
    }

    // Remove user from participantIds
    const updatedParticipantIds = conversation.participantIds.filter((id) => id !== userId);

    // Check if user is an admin and handle admin transfer
    const isAdmin = isGroupAdmin(conversation, userId);
    let updatedAdminIds = conversation.adminIds || [];

    if (isAdmin && updatedAdminIds.length > 0) {
      // Remove user from adminIds
      updatedAdminIds = updatedAdminIds.filter((id) => id !== userId);

      // If no admins left and there are still participants, make the first one admin
      if (updatedAdminIds.length === 0 && updatedParticipantIds.length > 0) {
        updatedAdminIds = [updatedParticipantIds[0]];
      }
    }

    // Update conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      participantIds: updatedParticipantIds,
      adminIds: updatedAdminIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error leaving group:', error);

    if (error instanceof Error) {
      throw error;
    }

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. Unable to leave group.');
    }

    throw new Error('Failed to leave group. Please try again.');
  }
}

/**
 * Removes a member from a group conversation (admin action)
 *
 * @param conversationId - Conversation ID
 * @param memberIdToRemove - User ID of member to remove
 * @param adminId - User ID of admin performing the action
 * @returns Promise resolving when member is removed
 * @throws {Error} When user lacks admin permissions or removal fails
 *
 * @remarks
 * - Only admins can remove other members
 * - Admins cannot remove other admins (they must leave voluntarily)
 * - Updates participantIds array
 *
 * @example
 * ```typescript
 * await removeMember('group123', 'user456', 'adminUser123');
 * // Admin removes user456 from the group
 * ```
 */
export async function removeMember(
  conversationId: string,
  memberIdToRemove: string,
  adminId: string
): Promise<void> {
  try {
    const db = getFirebaseDb();

    // Get conversation to check permissions and current state
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only remove members from group conversations.');
    }

    // Check if caller is an admin
    if (!isGroupAdmin(conversation, adminId)) {
      throw new Error('Only group admins can remove members.');
    }

    // Check if member to remove exists in the group
    if (!conversation.participantIds.includes(memberIdToRemove)) {
      throw new Error('User is not a member of this group.');
    }

    // Prevent removing other admins
    if (isGroupAdmin(conversation, memberIdToRemove)) {
      throw new Error('Cannot remove other admins. They must leave voluntarily.');
    }

    // Remove member from participantIds
    const updatedParticipantIds = conversation.participantIds.filter((id) => id !== memberIdToRemove);

    // Update conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      participantIds: updatedParticipantIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error removing member:', error);

    if (error instanceof Error) {
      throw error;
    }

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. Unable to remove member.');
    }

    throw new Error('Failed to remove member. Please try again.');
  }
}

/**
 * Mutes or unmutes notifications for a conversation for a specific user
 *
 * @param conversationId - Conversation ID to mute/unmute
 * @param userId - User ID muting/unmuting the conversation
 * @param mute - True to mute, false to unmute
 * @returns Promise resolving when update is complete
 * @throws {Error} When user is not a participant or update fails
 *
 * @remarks
 * - Updates the mutedBy map in the conversation document
 * - Only participants can mute/unmute conversations
 * - Muted conversations still show unread badges, only push notifications are suppressed
 * - The Cloud Function respects this mute setting when sending push notifications
 *
 * @example
 * ```typescript
 * // Mute conversation
 * await muteConversation('user123_user456', 'user123', true);
 *
 * // Unmute conversation
 * await muteConversation('user123_user456', 'user123', false);
 * ```
 */
export async function muteConversation(
  conversationId: string,
  userId: string,
  mute: boolean
): Promise<void> {
  try {
    const db = getFirebaseDb();

    // Get conversation to check if user is a participant
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    if (!conversation.participantIds.includes(userId)) {
      throw new Error('You must be a participant in this conversation to mute it.');
    }

    // Update mutedBy field for this user
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      [`mutedBy.${userId}`]: mute,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error muting conversation:', error);

    // Re-throw custom error messages (from validation logic)
    if (error instanceof Error && error.message.includes('Conversation not found')) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('must be a participant')) {
      throw error;
    }

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'not-found') {
      throw new Error('Conversation not found.');
    }

    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. Unable to update mute settings.');
    }

    throw new Error('Failed to update mute settings. Please try again.');
  }
}
