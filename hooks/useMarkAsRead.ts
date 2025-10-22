/**
 * Hook for automatically marking messages as read
 * @module hooks/useMarkAsRead
 */

import { useEffect, useRef } from 'react';
import { markMessagesAsReadBatch } from '@/services/messageService';
import { useAuth } from '@/hooks/useAuth';
import type { Message } from '@/types/models';

/**
 * Automatically marks messages as read when they appear on screen
 * @param conversationId - The conversation being viewed
 * @param messages - Array of messages currently visible
 * @param enabled - Whether to enable auto-marking (default: true)
 * @example
 * ```tsx
 * function ChatScreen({ conversationId }) {
 *   const { messages } = useMessages(conversationId);
 *   useMarkAsRead(conversationId, messages);
 *   // Messages are automatically marked as read
 * }
 * ```
 */
export function useMarkAsRead(
  conversationId: string,
  messages: Message[],
  enabled: boolean = true
) {
  const { user } = useAuth();
  const processedMessageIds = useRef<Set<string>>(new Set());
  const pendingMarkIds = useRef<string[]>([]);
  const markTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || !user?.uid || messages.length === 0) {
      return;
    }

    // Find unread messages from other users
    const unreadMessageIds = messages
      .filter((msg) => {
        // Skip if:
        // - Message is from current user
        // - Already marked as read by current user
        // - Already processed in this session
        return (
          msg.senderId !== user.uid &&
          !msg.readBy.includes(user.uid) &&
          !processedMessageIds.current.has(msg.id)
        );
      })
      .map((msg) => msg.id);

    if (unreadMessageIds.length === 0) {
      return;
    }

    // Add to pending list
    pendingMarkIds.current.push(...unreadMessageIds);

    // Mark as processed immediately to prevent duplicates
    unreadMessageIds.forEach((id) => {
      processedMessageIds.current.add(id);
    });

    // Clear existing timeout
    if (markTimeoutRef.current) {
      clearTimeout(markTimeoutRef.current);
    }

    // Batch mark after 1 second delay (to batch multiple messages)
    markTimeoutRef.current = setTimeout(async () => {
      if (pendingMarkIds.current.length > 0) {
        const idsToMark = [...pendingMarkIds.current];
        pendingMarkIds.current = [];

        try {
          await markMessagesAsReadBatch(conversationId, idsToMark, user.uid);
        } catch (error) {
          console.error('Failed to mark messages as read:', error);
          // Remove from processed so we can retry
          idsToMark.forEach((id) => {
            processedMessageIds.current.delete(id);
          });
        }
      }
    }, 1000);

    return () => {
      if (markTimeoutRef.current) {
        clearTimeout(markTimeoutRef.current);
      }
    };
  }, [conversationId, messages, user?.uid, enabled]);

  // Clear processed IDs when conversation changes
  useEffect(() => {
    processedMessageIds.current.clear();
    pendingMarkIds.current = [];
  }, [conversationId]);
}
