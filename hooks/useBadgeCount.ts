/**
 * Hook for managing app icon badge count
 * @module hooks/useBadgeCount
 *
 * @remarks
 * Automatically synchronizes badge count with total unread messages across all conversations
 */

import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/hooks/useAuth';
import type { Conversation } from '@/types/models';

/**
 * Hook that manages app icon badge count based on unread messages
 * @returns void - Manages badge count automatically
 * @example
 * ```tsx
 * function App() {
 *   useBadgeCount(); // Auto-updates badge based on unread counts
 * }
 * ```
 */
export function useBadgeCount() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    // Calculate and update badge count from conversations
    const updateBadgeFromConversations = (conversations: Conversation[]) => {
      const totalUnread = conversations.reduce((sum, conv) => {
        return sum + (conv.unreadCount?.[user.uid] || 0);
      }, 0);

      notificationService.updateBadgeCount(totalUnread);
    };

    // Listen to conversations to get real-time unread counts
    const conversationsRef = collection(getFirebaseDb(), 'conversations');
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Conversation[];

      updateBadgeFromConversations(conversations);
    });

    // Update badge when app becomes active (in case it drifted while backgrounded)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Recalculate badge from current conversation state
        // The snapshot listener above will trigger an update
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [user?.uid]);
}
