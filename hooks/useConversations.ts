/**
 * Custom hook for managing conversation data with real-time Firestore updates
 *
 * @remarks
 * Subscribes to conversations for a specific user and provides real-time updates.
 * Automatically handles cleanup on unmount to prevent memory leaks.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { subscribeToConversations, refreshConversations } from '@/services/conversationService';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import type { Conversation } from '@/types/models';

/**
 * Return type for useConversations hook
 */
interface UseConversationsResult {
  /** Array of conversations for the user (sorted with priority first) */
  conversations: Conversation[];

  /** Loading state (true while fetching initial data) */
  loading: boolean;

  /** Error message if subscription fails, null otherwise */
  error: string | null;

  /** Function to manually refresh conversations (for pull-to-refresh) */
  refresh: () => Promise<void>;

  /** Refreshing state (true during manual refresh) */
  refreshing: boolean;

  /** Map of conversation IDs to their highest opportunity scores (Story 5.6 - Task 8) */
  opportunityScores: Record<string, number>;
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
 * The conversations are automatically sorted with priority sorting:
 * 1. High-value opportunities (opportunityScore >= 70) appear first
 * 2. Within each priority level, sorted by most recent activity (lastMessageTimestamp desc)
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

  // Track opportunity scores for each conversation (Story 5.6 - Task 8)
  const [opportunityScores, setOpportunityScores] = useState<Record<string, number>>({});

  /**
   * Manual refresh function for pull-to-refresh
   */
  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const result = await refreshConversations(userId);
      setConversations(result.conversations);
    } catch (err) {
      console.error('Error refreshing conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh conversations');
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {

    // Don't subscribe if no userId
    if (!userId) {

      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Subscribe to real-time conversation updates
      const unsubscribe = subscribeToConversations(userId, (updatedConversations) => {

        setConversations(updatedConversations);
        setLoading(false);
      });

      // Cleanup: Unsubscribe when component unmounts or userId changes
      return () => {

        unsubscribe();
      };
    } catch (err) {
      console.error('Error subscribing to conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      setLoading(false);
    }
  }, [userId]);

  // Subscribe to opportunity scores for all conversations (Story 5.6 - Task 8)
  useEffect(() => {
    if (conversations.length === 0) {
      return;
    }

    const db = getFirebaseDb();
    const unsubscribes: (() => void)[] = [];

    // For each conversation, subscribe to its highest opportunity score
    conversations.forEach((conversation) => {
      const messagesQuery = query(
        collection(db, 'conversations', conversation.id, 'messages'),
        where('metadata.opportunityScore', '>', 0),
        orderBy('metadata.opportunityScore', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const score = snapshot.empty ? 0 : snapshot.docs[0].data().metadata?.opportunityScore || 0;
          setOpportunityScores((prev) => ({ ...prev, [conversation.id]: score }));
        },
        (error) => {
          console.error(`Failed to query opportunity score for conversation ${conversation.id}:`, error);
          // Set score to 0 on error so conversation still appears
          setOpportunityScores((prev) => ({ ...prev, [conversation.id]: 0 }));
        }
      );

      unsubscribes.push(unsubscribe);
    });

    // Cleanup: Unsubscribe from all opportunity score queries
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [conversations]);

  /**
   * Sort conversations with priority sorting (Story 5.6 - Task 8):
   * 1. High-value opportunities (score >= 70) first
   * 2. Within priority levels, sort by most recent activity
   */
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const scoreA = opportunityScores[a.id] || 0;
      const scoreB = opportunityScores[b.id] || 0;

      // Priority conversations (score >= 70) appear first
      const isPriorityA = scoreA >= 70;
      const isPriorityB = scoreB >= 70;

      if (isPriorityA && !isPriorityB) return -1;
      if (!isPriorityA && isPriorityB) return 1;

      // Within same priority level, sort by timestamp (most recent first)
      return b.lastMessageTimestamp.toMillis() - a.lastMessageTimestamp.toMillis();
    });
  }, [conversations, opportunityScores]);

  return {
    conversations: sortedConversations,
    loading,
    error,
    refresh,
    refreshing,
    opportunityScores,
  };
}
