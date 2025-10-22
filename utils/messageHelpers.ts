/**
 * Message helper utilities for chat functionality
 *
 * @remarks
 * These utilities help with message grouping, formatting, and display logic
 * for the chat interface, including date separator insertion.
 */

import type { Message, ChatListItem } from '@/types/models';
import type { Timestamp } from 'firebase/firestore';
import { shouldShowDateSeparator } from './dateHelpers';

/**
 * Groups messages with date separators for display in chat view
 *
 * @param messages - Array of messages sorted by timestamp (oldest first)
 * @returns Array of messages and date separators ready for FlatList rendering
 *
 * @remarks
 * Inserts date separator items before messages when the date changes.
 * Always inserts a separator before the first message.
 * Maintains chronological order for inverted FlatList display.
 *
 * @example
 * ```typescript
 * const messages = [msg1, msg2, msg3]; // From different days
 * const items = groupMessagesWithSeparators(messages);
 * // Returns: [separator1, msg1, separator2, msg2, separator3, msg3]
 * ```
 */
export function groupMessagesWithSeparators(messages: Message[]): ChatListItem[] {
  if (messages.length === 0) {
    return [];
  }

  const items: ChatListItem[] = [];
  let previousTimestamp: Timestamp | null = null;

  messages.forEach((message) => {
    // Skip messages with null timestamps (serverTimestamp() not yet resolved)
    if (!message.timestamp) {
      console.warn(
        `Message ${message.id} has null timestamp - skipping for date separator grouping`
      );
      return;
    }

    // Check if we need a date separator
    if (shouldShowDateSeparator(message.timestamp, previousTimestamp)) {
      items.push({
        type: 'separator',
        id: `separator-${message.timestamp.toMillis()}`,
        timestamp: message.timestamp,
      });
    }

    // Add the message
    items.push({
      type: 'message',
      id: message.id,
      data: message,
    });

    previousTimestamp = message.timestamp;
  });

  return items;
}
