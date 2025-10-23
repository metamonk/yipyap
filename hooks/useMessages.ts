/**
 * Custom hook for managing real-time chat messages with optimistic UI updates
 *
 * @remarks
 * Handles message subscription, sending, and scroll management for chat conversations.
 * Uses Firestore onSnapshot for real-time updates and manages cleanup on unmount.
 * Implements optimistic UI updates for instant message display before server confirmation.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FlatList, Alert } from 'react-native';
import { Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { subscribeToMessages, sendMessage, getMessages, DraftConversationParams, markMessageAsDelivered } from '@/services/messageService';
import { useNetworkStatus } from './useNetworkStatus';
import type { Message } from '@/types/models';

/**
 * Extended message type that includes 'failed' status for optimistic messages
 */
type MessageWithFailedStatus = Message & {
  status: 'sending' | 'delivered' | 'read' | 'failed';
};

/**
 * Return type for the useMessages hook
 */
export interface UseMessagesResult {
  /** Array of messages sorted by timestamp (oldest to newest), including optimistic messages */
  messages: MessageWithFailedStatus[];

  /** Whether initial messages are still loading */
  loading: boolean;

  /** Function to send a new message */
  sendMessage: (text: string) => Promise<void>;

  /** Function to retry sending a failed message */
  retryMessage: (messageId: string) => Promise<void>;

  /** Ref to attach to the FlatList for scroll control */
  flatListRef: React.RefObject<FlatList | null>;

  /** Function to manually scroll to bottom of message list */
  scrollToBottom: () => void;

  /** Whether more messages are available to load */
  hasMore: boolean;

  /** Whether currently loading more messages (pagination) */
  isLoadingMore: boolean;

  /** Function to load next page of messages */
  loadMoreMessages: () => Promise<void>;

  /** Whether the device is currently offline */
  isOffline: boolean;
}

/**
 * Generates a temporary ID for optimistic messages
 * @returns Unique temporary ID string starting with "temp_"
 */
function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Custom hook for managing real-time chat messages with optimistic UI updates
 *
 * @param conversationId - The conversation ID to subscribe to
 * @param currentUserId - The current user's ID
 * @param participantIds - Array of participant IDs in the conversation
 * @param draftParams - Optional draft conversation params for creating conversation on first message
 * @returns Object containing messages, loading state, sendMessage/retryMessage functions, and scroll controls
 *
 * @remarks
 * - Automatically subscribes to message updates on mount
 * - Implements optimistic UI updates for instant message display
 * - Cleans up subscription on unmount to prevent memory leaks
 * - Messages are sorted by timestamp ascending (oldest to newest)
 * - Auto-scrolls to bottom when new messages arrive
 * - Handles errors with try-catch and user-friendly messages
 * - Deduplicates messages to prevent showing the same message twice
 * - Supports offline messaging: Messages sent while offline are queued automatically
 *   by Firestore and will sync when connection is restored
 * - Supports draft conversations: If draftParams provided, conversation is created on first message send
 *
 * @example
 * ```tsx
 * function ChatScreen() {
 *   const { messages, loading, sendMessage, retryMessage, flatListRef } = useMessages(
 *     'conv123',
 *     'user123',
 *     ['user123', 'user456']
 *   );
 *
 *   if (loading) {
 *     return <ActivityIndicator />;
 *   }
 *
 *   return (
 *     <FlatList
 *       ref={flatListRef}
 *       data={messages}
 *       renderItem={({ item }) => (
 *         <MessageItem
 *           message={item}
 *           onRetry={() => retryMessage(item.id)}
 *         />
 *       )}
 *     />
 *   );
 * }
 * ```
 */
export function useMessages(
  conversationId: string,
  currentUserId: string,
  participantIds: string[],
  draftParams?: DraftConversationParams
): UseMessagesResult {
  const [confirmedMessages, setConfirmedMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageWithFailedStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const { connectionStatus } = useNetworkStatus();

  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  /**
   * Merge optimistic and confirmed messages for display
   * Sorts by timestamp ascending (oldest to newest)
   */
  const messages = useMemo<MessageWithFailedStatus[]>(() => {
    // Combine both arrays and cast confirmed messages to include 'failed' status type
    const combined = [
      ...confirmedMessages.map((msg) => msg as MessageWithFailedStatus),
      ...optimisticMessages,
    ];

    // Sort by timestamp (handle null timestamps from serverTimestamp() pending resolution)
    return combined.sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() ?? 0;
      const bTime = b.timestamp?.toMillis?.() ?? 0;
      return aTime - bTime;
    });
  }, [confirmedMessages, optimisticMessages]);

  /**
   * Scrolls the message list to the bottom
   * Uses animated scroll for smooth UX
   */
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      // Small delay to ensure FlatList has rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  /**
   * Load initial messages with pagination support
   */
  useEffect(() => {
    // Skip loading messages for draft conversations that don't exist yet
    if (!conversationId || draftParams) {
      // For draft conversations, just set loading to false and return empty state
      if (draftParams) {
        setLoading(false);
        setConfirmedMessages([]);
        setHasMore(false);
      }
      return;
    }

    let isMounted = true;

    const loadInitialMessages = async () => {
      setLoading(true);
      try {
        // Fetch initial 50 messages with pagination info
        const result = await getMessages(conversationId, 50);

        if (isMounted) {
          // Set confirmed messages (already in oldest-to-newest order from service)
          setConfirmedMessages(result.messages);

          // Set pagination state
          setLastVisible(result.lastDoc);
          setHasMore(result.hasMore);
          setLoading(false);

          // Scroll to bottom after initial load
          scrollToBottom();
        }
      } catch (error) {
        console.error('Failed to load initial messages:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
    // scrollToBottom is intentionally omitted from deps to prevent infinite loops
    // It's only called inside the async function and doesn't need to trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, draftParams]);

  /**
   * Subscribe to real-time message updates for new messages
   * This supplements the initial paginated load with real-time updates
   */
  useEffect(() => {
    // Skip subscription for draft conversations or while loading
    if (!conversationId || loading || draftParams) {
      return;
    }

    // Debounce map for delivery status updates to prevent excessive calls
    const deliveryUpdateDebounce = new Map<string, ReturnType<typeof setTimeout>>();

    // Subscribe to messages (for real-time updates of new messages)
    const unsubscribe = subscribeToMessages(
      conversationId,
      (updatedMessages) => {
        /**
         * DEDUPLICATION STRATEGY for real-time updates
         *
         * Messages arrive from three sources:
         * 1. Initial pagination load (getMessages)
         * 2. Real-time listener (subscribeToMessages) - THIS CALLBACK
         * 3. Optimistic UI updates (sendMessage)
         *
         * This logic prevents duplicates by filtering real-time updates against:
         * - Confirmed messages (from pagination/previous real-time updates)
         * - Optimistic messages (from sendMessage before Firestore confirmation)
         *
         * Matching strategy uses TWO approaches:
         * A) ID matching - Simple case when IDs match exactly
         * B) Content + timestamp matching - For optimistic messages not yet confirmed
         *
         * Why 5-second timestamp variance?
         * - Client timestamp (optimistic): Timestamp.now() = device time
         * - Server timestamp (confirmed): serverTimestamp() = Firestore server time
         * - These can differ due to: network latency, clock skew, server processing
         * - 5 seconds allows for typical network delays while avoiding false positives
         * - If variance > 5s, treated as different messages (rare but handles edge cases)
         */
        setConfirmedMessages((prevConfirmed) => {
          // Use Set for O(1) lookup performance on existing message IDs
          const existingIds = new Set(prevConfirmed.map((m) => m.id));

          // Filter out messages that are already loaded
          const filteredMessages = updatedMessages.filter((confirmedMsg) => {
            // STEP 0: Skip messages with null timestamps (serverTimestamp not yet resolved)
            // These will be included in the next snapshot when the timestamp resolves
            if (!confirmedMsg.timestamp) {
              return false;
            }

            // STEP 1: Skip if already in confirmed messages (O(1) Set lookup)
            if (existingIds.has(confirmedMsg.id)) {
              return false;
            }

            // STEP 2: Check if this message exists in optimistic state
            // This prevents showing duplicate messages during the optimistic→confirmed transition
            const existsInOptimistic = optimisticMessages.some((optimisticMsg) => {
              // Match by Firestore ID (simplest case - IDs are identical)
              if (confirmedMsg.id === optimisticMsg.id) return true;

              // Match by content + timestamp variance (for optimistic messages)
              // This handles the case where:
              // - User sends message → optimistic message created with temp ID
              // - Firestore confirms → real-time listener receives message with real ID
              // - Need to detect these are the SAME message despite different IDs
              const optimisticTime = optimisticMsg.timestamp?.toMillis?.() ?? 0;
              const confirmedTime = confirmedMsg.timestamp?.toMillis?.() ?? 0;

              return (
                optimisticMsg.senderId === confirmedMsg.senderId &&
                optimisticMsg.text === confirmedMsg.text &&
                optimisticTime > 0 &&
                confirmedTime > 0 &&
                // 5-second window accounts for client-server time differences
                Math.abs(optimisticTime - confirmedTime) < 5000 // milliseconds
              );
            });

            // Only include messages that don't exist in optimistic state
            if (existsInOptimistic) {
              return false;
            }
            return true;
          });

          // Merge new messages with existing messages
          const merged = [...prevConfirmed, ...filteredMessages];

          // Sort by timestamp ascending (oldest to newest)
          // Handle null timestamps from serverTimestamp() pending resolution
          return merged.sort((a, b) => {
            const aTime = a.timestamp?.toMillis?.() ?? 0;
            const bTime = b.timestamp?.toMillis?.() ?? 0;
            return aTime - bTime;
          });
        });

        /**
         * DELIVERY STATUS UPDATE LOGIC (Story 3.2)
         *
         * When recipient's app receives a message via Firestore listener,
         * mark it as delivered to update the sender's UI.
         *
         * This implements:
         * - Recipient detection: Only mark delivered if current user is recipient (not sender)
         * - Idempotency: markMessageAsDelivered checks if already delivered/read
         * - Debouncing: Prevent excessive status updates when multiple messages arrive
         * - Offline handling: markMessageAsDelivered queues update if offline
         */
        updatedMessages.forEach((message) => {
          // Only mark as delivered if:
          // 1. Current user is NOT the sender (recipient only)
          // 2. Message has 'sending' status (not already delivered/read)
          // 3. Message has valid timestamp (serverTimestamp resolved)
          if (
            message.senderId !== currentUserId &&
            message.status === 'sending' &&
            message.timestamp
          ) {
            // Debounce delivery status updates (500ms delay)
            // This prevents multiple rapid calls when messages arrive in quick succession
            const existingTimeout = deliveryUpdateDebounce.get(message.id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            const timeout = setTimeout(async () => {
              try {
                await markMessageAsDelivered(conversationId, message.id);
                deliveryUpdateDebounce.delete(message.id);
              } catch (error) {
                // Error is logged and queued inside markMessageAsDelivered
                // Don't throw - delivery status update is not critical for UI
                console.error('Failed to mark message as delivered:', error);
                deliveryUpdateDebounce.delete(message.id);
              }
            }, 500);

            deliveryUpdateDebounce.set(message.id, timeout);
          }
        });

        // Auto-scroll to bottom when new messages arrive
        scrollToBottom();
      },
      50 // Listen to most recent 50 messages
    );

    // Cleanup subscription on unmount
    return () => {
      // Clear all pending debounce timeouts
      deliveryUpdateDebounce.forEach((timeout) => clearTimeout(timeout));
      deliveryUpdateDebounce.clear();
      unsubscribe();
    };
    // scrollToBottom is intentionally omitted from deps to prevent infinite loops
    // It's only called in the callback and doesn't need to trigger re-subscription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, loading, optimisticMessages, draftParams, currentUserId]);

  /**
   * Scroll to bottom after initial load
   */
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, messages.length, scrollToBottom]);

  /**
   * Sends a new message to the conversation with optimistic UI update
   *
   * @param text - The message text to send
   * @remarks
   * - Immediately adds message to optimistic state for instant UI feedback
   * - Removes from optimistic state on successful Firestore write
   * - Marks as 'failed' status if Firestore write fails (kept for retry)
   * - When offline: Message stays in 'sending' status and Firestore queues it automatically.
   *   It will be sent when connection is restored.
   */
  const handleSendMessage = useCallback(
    async (text: string) => {
      // Guard: Don't send if participants not loaded yet
      if (!participantIds || participantIds.length === 0) {
        console.error('Cannot send message: participants not loaded');
        throw new Error('Conversation not ready. Please try again.');
      }

      const tempId = generateTempId();

      // Create optimistic message
      const optimisticMessage: MessageWithFailedStatus = {
        id: tempId,
        conversationId,
        senderId: currentUserId,
        text: text.trim(),
        status: 'sending',
        readBy: [currentUserId],
        timestamp: Timestamp.now(), // Client timestamp (will be replaced with server timestamp)
        metadata: { aiProcessed: false },
      };

      // Immediately add to optimistic state for instant UI feedback
      setOptimisticMessages((prev) => [...prev, optimisticMessage]);
      scrollToBottom();

      // If offline, show message to user and let Firestore handle queuing
      if (connectionStatus === 'offline') {
        // Don't attempt to send or update conversation - Firestore will queue automatically
        // Message stays in optimistic state with 'sending' status
        return;
      }

      try {
        // Write to Firestore
        await sendMessage(
          {
            conversationId,
            senderId: currentUserId,
            text: text.trim(),
          },
          participantIds,
          draftParams // Pass draft params for conversation creation if needed
        );

        // Remove from optimistic state on success
        // Real-time listener will add the confirmed message
        setOptimisticMessages((prev) => prev.filter((msg) => msg.id !== tempId));

        // Note: updateConversationLastMessage is already called inside sendMessage service
        // so we don't need to call it again here to avoid double-counting unread messages
      } catch (error) {
        // Update optimistic message status to 'failed'
        setOptimisticMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? ({ ...msg, status: 'failed' as const } as unknown as MessageWithFailedStatus)
              : msg
          )
        );

        console.error('Failed to send message:', error);
        // Don't throw - keep message in optimistic state with failed status
        // User can retry using the retry button
      }
    },
    [conversationId, currentUserId, participantIds, scrollToBottom, connectionStatus, draftParams]
  );

  /**
   * Retries sending a failed message
   *
   * @param messageId - The ID of the failed message to retry
   * @remarks
   * - Finds the failed message in optimistic state
   * - Updates status to 'sending' during retry
   * - Removes from optimistic state on success
   * - Updates back to 'failed' status on failure
   */
  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      // Find the failed message in optimistic state
      const failedMessage = optimisticMessages.find((msg) => msg.id === messageId);

      if (!failedMessage) {
        console.error('Failed message not found:', messageId);
        return;
      }

      // Update status to 'sending' for retry
      setOptimisticMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'sending' as const } : msg))
      );

      try {
        // Re-attempt Firestore write
        await sendMessage(
          {
            conversationId,
            senderId: currentUserId,
            text: failedMessage.text,
          },
          participantIds,
          draftParams // Pass draft params for conversation creation if needed
        );

        // Remove from optimistic state on success
        setOptimisticMessages((prev) => prev.filter((msg) => msg.id !== messageId));

        // Note: updateConversationLastMessage is already called inside sendMessage service
        // so we don't need to call it again here to avoid double-counting unread messages

        scrollToBottom();
      } catch (error) {
        // Update back to 'failed' status
        setOptimisticMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? ({ ...msg, status: 'failed' as const } as unknown as MessageWithFailedStatus)
              : msg
          )
        );

        console.error('Retry failed:', error);
        Alert.alert('Failed to send message', 'Please check your connection and try again.');
      }
    },
    [conversationId, currentUserId, participantIds, optimisticMessages, scrollToBottom, draftParams]
  );

  /**
   * Loads the next page of messages using cursor-based pagination
   *
   * @remarks
   * - Checks hasMore flag to prevent unnecessary queries
   * - Uses lastVisible cursor from previous page
   * - Appends new messages to existing messages (with deduplication)
   * - Updates pagination state for next page
   */
  const loadMoreMessages = useCallback(async () => {
    // Early return if no more messages, already loading, or draft conversation
    if (!hasMore || isLoadingMore || draftParams) {
      return;
    }

    setIsLoadingMore(true);
    try {
      // Fetch next page of messages
      const result = await getMessages(conversationId, 50, lastVisible);

      // Append new messages to existing messages (deduplicate by ID)
      setConfirmedMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMessages = result.messages.filter((msg) => !existingIds.has(msg.id));

        // Merge and sort by timestamp
        // Handle null timestamps from serverTimestamp() pending resolution
        const merged = [...prev, ...newMessages];
        return merged.sort((a, b) => {
          const aTime = a.timestamp?.toMillis?.() ?? 0;
          const bTime = b.timestamp?.toMillis?.() ?? 0;
          return aTime - bTime;
        });
      });

      // Update pagination state
      setLastVisible(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load more messages:', error);
      // Don't throw - just log error and allow user to retry
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, hasMore, isLoadingMore, lastVisible, draftParams]);

  return {
    messages,
    loading,
    sendMessage: handleSendMessage,
    retryMessage: handleRetryMessage,
    flatListRef,
    scrollToBottom,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
    isOffline: connectionStatus === 'offline',
  };
}
