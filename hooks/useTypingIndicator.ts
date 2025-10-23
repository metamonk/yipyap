/**
 * Custom hook for monitoring typing indicators in a conversation
 *
 * @remarks
 * Subscribes to Firebase Realtime Database for typing state changes.
 * Automatically fetches display names for typing users.
 * Filters out current user's typing state.
 * Cleans up RTDB listener on unmount.
 *
 * @module hooks/useTypingIndicator
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { typingService } from '@/services/typingService';
import { getUserProfile } from '@/services/userService';
import type { TypingIndicator } from '@/types/models';
import type { TypingUser } from '@/components/chat/TypingIndicator';

/**
 * Result object returned by useTypingIndicator hook
 */
export interface UseTypingIndicatorResult {
  /** Array of users currently typing with their display names */
  typingUsers: TypingUser[];

  /** Whether typing data is being loaded */
  loading: boolean;

  /** Error message if fetching display names failed */
  error: string | null;
}

/**
 * Custom hook for managing typing indicators in a conversation
 *
 * @param conversationId - The conversation to monitor for typing activity
 * @param currentUserId - The current user's ID (to filter out own typing state)
 * @returns Object containing array of typing users and their display names
 *
 * @remarks
 * - Subscribes to RTDB path: `/typing/{conversationId}`
 * - Filters out current user's typing state automatically
 * - Fetches display names for all typing users
 * - Caches display names to avoid repeated fetches
 * - Handles multiple users typing simultaneously
 * - Cleans up RTDB listener on unmount
 *
 * @example
 * ```tsx
 * function ChatView({ conversationId }) {
 *   const { user } = useAuth();
 *   const { typingUsers, loading, error } = useTypingIndicator(conversationId, user?.uid);
 *
 *   return (
 *     <View>
 *       <MessageList messages={messages} />
 *       {typingUsers.length > 0 && (
 *         <TypingIndicator typingUsers={typingUsers} />
 *       )}
 *       <MessageInput conversationId={conversationId} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useTypingIndicator(
  conversationId: string | undefined,
  currentUserId: string | undefined
): UseTypingIndicatorResult {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache display names to avoid repeated fetches
  const displayNameCache = useRef<Map<string, string>>(new Map());

  /**
   * Fetches display name for a user ID with caching
   * @param userId - User ID to fetch display name for
   * @returns Object with display name and error flag
   */
  const getDisplayName = useCallback(
    async (userId: string): Promise<{ displayName: string; hadError: boolean }> => {
      // Check cache first
      const cached = displayNameCache.current.get(userId);
      if (cached) {
        return { displayName: cached, hadError: false };
      }

      try {
        const profile = await getUserProfile(userId);
        const displayName = profile?.displayName || 'Someone';

        // Cache the result
        displayNameCache.current.set(userId, displayName);

        return { displayName, hadError: false };
      } catch (error) {
        console.error('Failed to fetch display name for user:', userId, error);
        return { displayName: 'Someone', hadError: true };
      }
    },
    []
  );

  /**
   * Handles typing state changes from RTDB
   * @param typingData - Record of user IDs to typing indicators
   */
  const handleTypingChange = useCallback(
    async (typingData: Record<string, TypingIndicator>) => {
      try {
        setLoading(true);

        // Get array of typing user IDs
        const typingUserIds = Object.keys(typingData);

        if (typingUserIds.length === 0) {
          setTypingUsers([]);
          setError(null);
          setLoading(false);
          return;
        }

        // Fetch display names for all typing users
        const results = await Promise.all(
          typingUserIds.map(async (userId) => {
            const result = await getDisplayName(userId);
            return { userId, displayName: result.displayName, hadError: result.hadError };
          })
        );

        // Check if any display name fetch failed
        const hadAnyError = results.some((r) => r.hadError);

        // Set error state before updating loading state
        if (hadAnyError) {
          setError('Failed to load typing users');
        } else {
          setError(null);
        }

        // Set typing users with display names (even if some had errors)
        const typingUsersWithNames = results.map((r) => ({
          userId: r.userId,
          displayName: r.displayName,
        }));
        setTypingUsers(typingUsersWithNames);
      } catch (err) {
        console.error('Error processing typing state:', err);
        setError('Failed to load typing users');
        setTypingUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [getDisplayName]
  );

  useEffect(() => {
    // Don't subscribe if missing required params
    if (!conversationId || !currentUserId) {
      setTypingUsers([]);
      return;
    }

    // Subscribe to typing indicators
    const unsubscribe = typingService.subscribeToTyping(
      conversationId,
      currentUserId,
      handleTypingChange
    );

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [conversationId, currentUserId, handleTypingChange]);

  return {
    typingUsers,
    loading,
    error,
  };
}
