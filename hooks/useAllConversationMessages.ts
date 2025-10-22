import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Message } from '@/types/models';

/**
 * Return type for useAllConversationMessages hook
 */
export interface UseAllConversationMessagesResult {
  /** All messages from user's conversations */
  messages: Message[];

  /** Whether messages are currently being loaded */
  loading: boolean;

  /** Error message if loading fails */
  error: string | null;

  /** Manually trigger message reload */
  reload: () => Promise<void>;
}

const MESSAGES_PER_CONVERSATION = 50; // Load recent 50 messages from each conversation

/**
 * Custom hook for loading recent messages from all user's conversations
 *
 * @remarks
 * This hook loads the most recent messages from all conversations where
 * the user is a participant. It's intended for cross-conversation search
 * functionality.
 *
 * Performance considerations:
 * - Loads MESSAGES_PER_CONVERSATION (50) recent messages from each conversation
 * - For users with many conversations, this can be expensive
 * - Only loads when explicitly triggered (not on mount)
 * - Uses Firestore offline cache when available
 *
 * Limitations:
 * - Only searches loaded messages, not entire conversation history
 * - May miss older messages that haven't been loaded
 * - Firestore query costs scale with number of conversations
 *
 * @param conversationIds - Array of conversation IDs to load messages from
 * @param enabled - Whether to automatically load messages (default: false)
 * @returns Object with messages array, loading state, error, and reload function
 *
 * @example
 * ```typescript
 * function SearchScreen({ conversationIds }) {
 *   const { messages, loading, reload } = useAllConversationMessages(conversationIds, true);
 *
 *   // Use messages with search hook
 *   const { searchResults, searchMessages } = useMessageSearch(messages);
 *
 *   return <SearchResults results={searchResults} />;
 * }
 * ```
 */
export function useAllConversationMessages(
  conversationIds: string[],
  enabled: boolean = false
): UseAllConversationMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads messages from all conversations
   */
  const loadMessages = useCallback(async () => {
    if (conversationIds.length === 0) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load messages from each conversation
      const messagePromises = conversationIds.map(async (conversationId) => {
        try {
          const messagesRef = collection(db, 'conversations', conversationId, 'messages');
          const q = query(
            messagesRef,
            orderBy('timestamp', 'desc'),
            limit(MESSAGES_PER_CONVERSATION)
          );

          const querySnapshot = await getDocs(q);
          const conversationMessages: Message[] = [];

          querySnapshot.forEach((doc) => {
            conversationMessages.push({
              id: doc.id,
              ...doc.data(),
            } as Message);
          });

          return conversationMessages;
        } catch (err) {
          console.error(`Error loading messages from conversation ${conversationId}:`, err);
          return [];
        }
      });

      // Wait for all conversations to load
      const allMessages = await Promise.all(messagePromises);

      // Flatten and sort by timestamp (newest first)
      const flattenedMessages = allMessages.flat();
      flattenedMessages.sort((a, b) => {
        const aTime = a.timestamp?.toMillis() || 0;
        const bTime = b.timestamp?.toMillis() || 0;
        return bTime - aTime; // Descending order (newest first)
      });

      setMessages(flattenedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('Error loading all conversation messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationIds]);

  /**
   * Auto-load messages when enabled and conversationIds change
   */
  useEffect(() => {
    if (enabled) {
      loadMessages();
    }
  }, [enabled, loadMessages]);

  return {
    messages,
    loading,
    error,
    reload: loadMessages,
  };
}
