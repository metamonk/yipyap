/**
 * Custom hook for checking if current user has admin privileges in a conversation
 *
 * @remarks
 * Provides a convenient hook for components that need to conditionally
 * render admin-only UI elements or functionality.
 */

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Conversation } from '@/types/models';
import { isGroupAdmin as checkIsGroupAdmin } from '@/services/conversationService';

/**
 * Hook to check if the current user is an admin of a group conversation
 *
 * @param conversation - The conversation to check (can be null if loading)
 * @returns True if current user is an admin, false otherwise
 *
 * @remarks
 * Returns false for direct conversations or when conversation is null.
 * Automatically updates when conversation or user changes.
 *
 * @example
 * ```tsx
 * function GroupHeader({ conversation }) {
 *   const isAdmin = useGroupAdmin(conversation);
 *
 *   return (
 *     <View>
 *       <Text>{conversation.groupName}</Text>
 *       {isAdmin && <Button title="Edit Group" onPress={handleEdit} />}
 *     </View>
 *   );
 * }
 * ```
 */
export function useGroupAdmin(conversation: Conversation | null): boolean {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user || !conversation) {
      return false;
    }

    return checkIsGroupAdmin(conversation, user.uid);
  }, [conversation, user]);
}
