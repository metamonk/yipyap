/**
 * Global message listener for triggering notifications
 * @module hooks/useGlobalMessageListener
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePathname } from 'expo-router';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { notificationService } from '@/services/notificationService';
import { getUserProfile } from '@/services/userService';
import { useAuth } from './useAuth';
import type { Message, Conversation } from '@/types/models';

/**
 * Hook that listens to all conversations for new messages and triggers notifications
 * @remarks
 * This hook runs globally and listens to messages across all conversations
 * the user is part of. It triggers notifications for new messages from other users
 * when the app is in the foreground and the user is not viewing that conversation.
 */
export function useGlobalMessageListener() {
  const { user } = useAuth();
  const pathname = usePathname();
  const lastMessageTimestampRef = useRef<number>(0);
  const userCacheRef = useRef<Map<string, string>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize timestamp in useEffect to avoid calling impure function during render
  useEffect(() => {
    if (lastMessageTimestampRef.current === 0) {
      lastMessageTimestampRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    // Track app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const db = getFirebaseDb();

    // Create a map to track unsubscribe functions for each conversation
    const unsubscribers: (() => void)[] = [];

    // Function to get or fetch user display name
    const getUserDisplayName = async (userId: string): Promise<string> => {
      // Check cache first
      if (userCacheRef.current.has(userId)) {
        return userCacheRef.current.get(userId)!;
      }

      try {
        const profile = await getUserProfile(userId);
        const displayName = profile?.displayName || userId;
        userCacheRef.current.set(userId, displayName);
        return displayName;
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        return userId; // Fallback to user ID
      }
    };

    // Function to check if user is viewing a specific conversation
    const isViewingConversation = (conversationId: string): boolean => {
      // Check if the current route is the conversation screen with this ID
      return pathname === `/(tabs)/conversations/${conversationId}`;
    };

    // Listen to the user's conversations
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );

    const conversationUnsubscribe = onSnapshot(
      conversationsQuery,
      async (snapshot) => {
        // Clean up previous message listeners
        unsubscribers.forEach((unsub) => unsub());
        unsubscribers.length = 0;

        // Set up listeners for each conversation
        snapshot.docs.forEach((doc) => {
          const conversation = { id: doc.id, ...doc.data() } as Conversation;

          // Skip newly created conversations without any messages yet
          // This prevents race conditions where the conversation document exists locally
          // but hasn't propagated to the server, causing permission errors when
          // trying to set up message listeners that require reading the parent document
          if (!conversation.lastMessageTimestamp) {
            return; // No messages yet, nothing to listen to
          }

          // Listen to recent messages in this conversation
          const messagesQuery = query(
            collection(db, 'conversations', conversation.id, 'messages'),
            orderBy('timestamp', 'desc'),
            limit(1) // Only listen to the most recent message
          );

          const messageUnsubscribe = onSnapshot(
            messagesQuery,
            async (messageSnapshot) => {
              if (messageSnapshot.empty) return;

              const latestDoc = messageSnapshot.docs[0];
              const message = { id: latestDoc.id, ...latestDoc.data() } as Message;

              // Check if this is a new message (not from initial load)
              const messageTime = message.timestamp?.toMillis?.() || 0;
              if (messageTime <= lastMessageTimestampRef.current) {
                return; // Skip old messages
              }

              // Update last message timestamp
              lastMessageTimestampRef.current = Math.max(
                lastMessageTimestampRef.current,
                messageTime
              );

              // Only show notification if:
              // 1. Message is from another user
              // 2. App is in foreground
              // 3. User is not viewing this conversation
              // 4. Message has valid timestamp (not pending)
              if (
                message.senderId !== user.uid &&
                appStateRef.current === 'active' &&
                !isViewingConversation(conversation.id) &&
                message.timestamp
              ) {
                // Get sender's display name
                const senderName = await getUserDisplayName(message.senderId);

                // Get conversation name (for groups)
                const conversationName =
                  conversation.type === 'group' ? conversation.groupName : undefined;

                // Show notification
                await notificationService
                  .showNewMessageNotification(message, senderName, conversationName)
                  .catch((error) => {
                    console.error('Failed to show notification:', error);
                  });
              }
            },
            (error) => {
              console.error('Error listening to messages:', error);
            }
          );

          unsubscribers.push(messageUnsubscribe);
        });
      },
      (error) => {
        console.error('Error listening to conversations:', error);
      }
    );

    // Cleanup function
    return () => {
      conversationUnsubscribe();
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user?.uid, pathname]);
}
