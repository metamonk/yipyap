/**
 * Custom hook for managing conversation data with real-time Firestore updates
 *
 * @remarks
 * Subscribes to conversations for a specific user and provides real-time updates.
 * Automatically handles cleanup on unmount to prevent memory leaks.
 */

import { useState, useEffect, useCallback } from 'react';
import { subscribeToConversations, refreshConversations } from '@/services/conversationService';
import type { Conversation } from '@/types/models';

/**
 * Return type for useConversations hook
 */
interface UseConversationsResult {
  /** Array of conversations for the user (sorted by most recent) */
  conversations: Conversation[];

  /** Loading state (true while fetching initial data) */
  loading: boolean;

  /** Error message if subscription fails, null otherwise */
  error: string | null;

  /** Function to manually refresh conversations (for pull-to-refresh) */
  refresh: () => Promise<void>;

  /** Refreshing state (true during manual refresh) */
  refreshing: boolean;
}

/**
 * Custom hook for subscribing to user conversations with real-time updates
 *
 * @param userId - The current user's ID to fetch conversations for
 * @returns Object containing conversations array, loading state, error, and refresh function
 *
 * @remarks
 * This hook:
 * - Sets up a real-time Firestore listener for conversations
 * - Automatically cleans up the listener on unmount
 * - Handles loading and error states
 * - Provides a refresh function for pull-to-refresh
 * - Filters out deleted conversations
 *
 * The conversations are automatically sorted by most recent activity (lastMessageTimestamp desc).
 *
 * @example
 * ```tsx
 * function ConversationListScreen() {
 *   const user = useAuth();
 *   const { conversations, loading, error, refresh, refreshing } = useConversations(user.uid);
 *
 *   if (loading) {
 *     return <ActivityIndicator />;
 *   }
 *
 *   if (error) {
 *     return <ErrorMessage message={error} />;
 *   }
 *
 *   return (
 *     <FlatList
 *       data={conversations}
 *       refreshControl={
 *         <RefreshControl refreshing={refreshing} onRefresh={refresh} />
 *       }
 *       renderItem={({ item }) => <ConversationItem conversation={item} />}
 *     />
 *   );
 * }
 * ```
 */
export function useConversations(userId: string): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Manual refresh function for pull-to-refresh
   */
  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const freshConversations = await refreshConversations(userId);
      setConversations(freshConversations);
    } catch (err) {
      console.error('Error refreshing conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh conversations');
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    console.log('[useConversations] Effect triggered with userId:', userId);

    // Don't subscribe if no userId
    if (!userId) {
      console.log('[useConversations] No userId, setting loading to false');
      setLoading(false);
      return;
    }

    console.log('[useConversations] Setting up subscription for userId:', userId);
    setLoading(true);
    setError(null);

    try {
      // Subscribe to real-time conversation updates
      const unsubscribe = subscribeToConversations(userId, (updatedConversations) => {
        console.log('[useConversations] Received conversations update:', {
          count: updatedConversations.length,
          conversations: updatedConversations.map(c => ({
            id: c.id,
            type: c.type,
            participantCount: c.participants.length,
          })),
        });
        setConversations(updatedConversations);
        setLoading(false);
      });

      console.log('[useConversations] Subscription setup complete');

      // Cleanup: Unsubscribe when component unmounts or userId changes
      return () => {
        console.log('[useConversations] Cleaning up subscription');
        unsubscribe();
      };
    } catch (err) {
      console.error('[useConversations] Error subscribing to conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      setLoading(false);
    }
  }, [userId]);

  return {
    conversations,
    loading,
    error,
    refresh,
    refreshing,
  };
}
