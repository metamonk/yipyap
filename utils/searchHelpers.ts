import { Message } from '@/types/models';

/**
 * Filters messages by keyword using case-insensitive substring matching
 *
 * @remarks
 * This function performs client-side filtering of messages based on a search query.
 * It uses case-insensitive substring matching to find messages containing the query text.
 * Empty or whitespace-only queries return all messages unchanged.
 *
 * Performance: O(n) where n is the number of messages. Suitable for filtering
 * up to ~1000 messages with <50ms execution time.
 *
 * Limitations:
 * - Only searches the message text field, not sender names or other metadata
 * - No advanced search operators (AND, OR, NOT)
 * - No fuzzy matching or typo tolerance
 *
 * @param messages - Array of messages to search through
 * @param query - Search keyword(s) to match. Leading/trailing whitespace is trimmed.
 * @returns Filtered array of messages matching the query. Returns all messages if query is empty.
 *
 * @example
 * ```typescript
 * const messages = [
 *   { id: '1', text: 'Hello world', ... },
 *   { id: '2', text: 'Goodbye moon', ... }
 * ];
 * const results = filterMessagesByKeyword(messages, 'hello');
 * // Returns [{ id: '1', text: 'Hello world', ... }]
 * ```
 *
 * @example
 * ```typescript
 * // Case-insensitive matching
 * const results = filterMessagesByKeyword(messages, 'HELLO');
 * // Returns messages containing 'hello' in any case
 * ```
 *
 * @example
 * ```typescript
 * // Empty query returns all messages
 * const results = filterMessagesByKeyword(messages, '');
 * // Returns all messages unchanged
 * ```
 */
export function filterMessagesByKeyword(messages: Message[], query: string): Message[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return messages;
  }

  return messages.filter((message) => message.text.toLowerCase().includes(normalizedQuery));
}
