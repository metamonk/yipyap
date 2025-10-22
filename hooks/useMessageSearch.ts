import { useState, useMemo, useCallback } from 'react';
import { Message } from '@/types/models';
import { filterMessagesByKeyword } from '@/utils/searchHelpers';

/**
 * Return type for the useMessageSearch hook
 */
export interface UseMessageSearchResult {
  /** Array of messages matching the current search query */
  searchResults: Message[];

  /** Current search query string */
  searchQuery: string;

  /** Whether a search is active (query is not empty) */
  isSearching: boolean;

  /** Updates the search query and filters messages */
  searchMessages: (query: string) => void;

  /** Clears the search query and resets results */
  clearSearch: () => void;
}

/**
 * Custom hook for managing message search functionality
 *
 * @remarks
 * This hook provides search state management and filtering logic for messages.
 * It handles:
 * - Search query state
 * - Filtered results with memoization
 * - Search active/inactive state
 * - Clear search functionality
 *
 * The hook uses `useMemo` to optimize performance by only recalculating
 * filtered results when the messages array or search query changes.
 *
 * Important: This hook only filters the messages provided to it. It does not
 * fetch messages from Firestore. Use it in conjunction with `useMessages` or
 * similar hooks that provide the messages array.
 *
 * @param messages - Array of messages to search through (from useMessages or similar)
 * @returns Object containing search results, query, state, and control functions
 *
 * @example
 * ```typescript
 * function ChatScreen({ conversationId }) {
 *   const { messages, loading } = useMessages(conversationId);
 *   const {
 *     searchResults,
 *     searchQuery,
 *     isSearching,
 *     searchMessages,
 *     clearSearch
 *   } = useMessageSearch(messages);
 *
 *   const displayMessages = isSearching ? searchResults : messages;
 *
 *   return (
 *     <View>
 *       <SearchBar
 *         onSearch={searchMessages}
 *         onClear={clearSearch}
 *       />
 *       <MessageList messages={displayMessages} />
 *     </View>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using with conversation list for cross-conversation search
 * function ConversationListScreen() {
 *   const allMessages = useAllConversationMessages();
 *   const { searchResults, searchMessages, clearSearch } = useMessageSearch(allMessages);
 *
 *   return (
 *     <SearchBar
 *       onSearch={searchMessages}
 *       onClear={clearSearch}
 *     />
 *   );
 * }
 * ```
 */
export function useMessageSearch(messages: Message[]): UseMessageSearchResult {
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Memoized filtered results
   * Only recalculates when messages or searchQuery changes
   */
  const searchResults = useMemo(() => {
    return filterMessagesByKeyword(messages, searchQuery);
  }, [messages, searchQuery]);

  /**
   * Whether search is active (query is not empty)
   */
  const isSearching = searchQuery.trim().length > 0;

  /**
   * Updates the search query
   * Memoized with useCallback to prevent unnecessary re-renders
   */
  const searchMessages = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Clears the search query and resets results
   * Memoized with useCallback to prevent unnecessary re-renders
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchResults,
    searchQuery,
    isSearching,
    searchMessages,
    clearSearch,
  };
}
