/**
 * Date and time utility functions for formatting timestamps
 *
 * @remarks
 * These utilities convert Firestore timestamps to human-readable relative time strings.
 * All functions handle timezone conversion from server timestamps to local time automatically.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Day names for week-based date formatting
 */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Month abbreviations for date formatting
 */
const MONTH_ABBRS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Formats a Firestore timestamp as a relative time string
 *
 * @param timestamp - Firestore Timestamp object to format
 * @returns Formatted relative time string based on how old the timestamp is
 *
 * @remarks
 * Returns different formats based on time elapsed:
 * - "Just now" for messages less than 1 minute old
 * - "5m ago" for messages less than 1 hour old
 * - "2h ago" for messages less than 24 hours old
 * - "Yesterday" for messages from the previous day
 * - "Monday" for messages less than 7 days old
 * - "Jan 15" for older messages
 *
 * Handles timezone conversion automatically from UTC server time to local time.
 *
 * @example
 * ```typescript
 * const now = Timestamp.now();
 * formatRelativeTime(now); // "Just now"
 *
 * const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
 * formatRelativeTime(fiveMinutesAgo); // "5m ago"
 *
 * const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
 * formatRelativeTime(yesterday); // "Yesterday"
 * ```
 */
export function formatRelativeTime(timestamp: Timestamp): string {
  // Handle null timestamps from serverTimestamp() pending resolution
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return 'Just now';
  }

  const now = new Date();
  const messageDate = timestamp.toDate();
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute
  if (diffMins < 1) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }

  // Less than 7 days - show day name
  if (diffDays < 7) {
    return DAY_NAMES[messageDate.getDay()];
  }

  // Older - show absolute date
  return `${MONTH_ABBRS[messageDate.getMonth()]} ${messageDate.getDate()}`;
}

/**
 * Formats a message timestamp for display in chat messages
 *
 * @param timestamp - Firestore Timestamp object to format
 * @returns Formatted time string for message display
 *
 * @remarks
 * Returns different formats based on when the message was sent:
 * - "10:45 AM" for messages sent today
 * - "Yesterday 10:45 AM" for messages sent yesterday
 * - "Jan 15, 10:45 AM" for older messages
 *
 * This format is more specific than formatRelativeTime, showing exact times
 * for better context in chat conversations.
 *
 * @example
 * ```typescript
 * const now = Timestamp.now();
 * formatMessageTime(now); // "10:45 AM"
 *
 * const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
 * formatMessageTime(yesterday); // "Yesterday 10:45 AM"
 *
 * const lastWeek = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
 * formatMessageTime(lastWeek); // "Jan 15, 10:45 AM"
 * ```
 */
export function formatMessageTime(timestamp: Timestamp): string {
  // Handle null timestamps from serverTimestamp() pending resolution
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return 'Just now';
  }

  const date = timestamp.toDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Format time string (e.g., "10:45 AM")
  const timeString = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Today
  if (messageDate.getTime() === today.getTime()) {
    return timeString;
  }

  // Yesterday
  if (messageDate.getTime() === today.getTime() - 86400000) {
    return `Yesterday ${timeString}`;
  }

  // Older - show date and time
  return `${MONTH_ABBRS[date.getMonth()]} ${date.getDate()}, ${timeString}`;
}

/**
 * Formats a timestamp as a date separator label
 *
 * @param timestamp - Firestore Timestamp to format
 * @returns Formatted date string for separator display
 *
 * @remarks
 * Returns different formats based on how old the date is:
 * - "Today" for current date
 * - "Yesterday" for previous day
 * - "Monday" for last 7 days (day name)
 * - "Jan 15, 2025" for older dates (includes year)
 *
 * @example
 * ```typescript
 * const today = Timestamp.now();
 * formatDateSeparator(today); // "Today"
 *
 * const lastWeek = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
 * formatDateSeparator(lastWeek); // "Monday"
 *
 * const lastYear = Timestamp.fromMillis(Date.now() - 365 * 24 * 60 * 60 * 1000);
 * formatDateSeparator(lastYear); // "Jan 15, 2024"
 * ```
 */
export function formatDateSeparator(timestamp: Timestamp): string {
  // Handle null timestamps
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return 'Today';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = timestamp.toDate();
  const messageDateOnly = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate()
  );

  const diffMs = today.getTime() - messageDateOnly.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  // Today
  if (diffDays === 0) {
    return 'Today';
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }

  // Last 7 days - show day name
  if (diffDays < 7 && diffDays > 0) {
    return DAY_NAMES[messageDate.getDay()];
  }

  // Older - show full date with year
  return `${MONTH_ABBRS[messageDate.getMonth()]} ${messageDate.getDate()}, ${messageDate.getFullYear()}`;
}

/**
 * Determines if a date separator should be shown between two messages
 *
 * @param currentMsg - Timestamp of current message
 * @param previousMsg - Timestamp of previous message (null if first message)
 * @returns True if messages are on different dates, false otherwise
 *
 * @remarks
 * Compares only the date component, ignoring time. Always returns true
 * for the first message (when previousMsg is null).
 *
 * @example
 * ```typescript
 * const msg1 = Timestamp.fromDate(new Date('2025-01-15 10:00'));
 * const msg2 = Timestamp.fromDate(new Date('2025-01-15 14:00'));
 * const msg3 = Timestamp.fromDate(new Date('2025-01-16 09:00'));
 *
 * shouldShowDateSeparator(msg2, msg1); // false (same day)
 * shouldShowDateSeparator(msg3, msg2); // true (different days)
 * shouldShowDateSeparator(msg1, null); // true (first message)
 * ```
 */
export function shouldShowDateSeparator(
  currentMsg: Timestamp,
  previousMsg: Timestamp | null
): boolean {
  // Always show separator for first message
  if (!previousMsg) {
    return true;
  }

  const currentDate = currentMsg.toDate();
  const previousDate = previousMsg.toDate();

  // Compare dates (ignore time component)
  const currentDateOnly = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const previousDateOnly = new Date(
    previousDate.getFullYear(),
    previousDate.getMonth(),
    previousDate.getDate()
  );

  return currentDateOnly.getTime() !== previousDateOnly.getTime();
}

/**
 * Formats a message timestamp as time only
 *
 * @param timestamp - Firestore Timestamp to format
 * @returns Time string in 12-hour format (e.g., "10:45 AM")
 *
 * @remarks
 * Simplified version of formatMessageTime that always returns just the time,
 * without date context. Useful when date context is provided by separators.
 *
 * @example
 * ```typescript
 * const now = Timestamp.now();
 * formatMessageTimestamp(now); // "10:45 AM"
 * ```
 */
export function formatMessageTimestamp(timestamp: Timestamp): string {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return 'Now';
  }

  const date = timestamp.toDate();
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
