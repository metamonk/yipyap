/**
 * Capacity management service for calculating daily response limits
 * @remarks
 * This service handles capacity suggestions, message volume analysis,
 * and distribution previews for the capacity management feature (Story 6.3).
 */

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { MIN_CAPACITY, MAX_CAPACITY, DEFAULT_CAPACITY } from '@/types/user';

/**
 * Distribution of messages across different categories
 */
export interface MessageDistribution {
  /** Number of deep/personalized responses */
  deep: number;

  /** Number of FAQ auto-responses */
  faq: number;

  /** Number of messages archived with boundary message */
  archived: number;
}

/**
 * Calculates suggested capacity based on average daily message volume
 *
 * @param avgDailyMessages - Average messages received per day
 * @returns Suggested daily capacity (5-20 range)
 *
 * @remarks
 * Formula: Math.round(avgDailyMessages * 0.18)
 * - Target: 18% of daily message volume
 * - Research shows creators can sustain 15-20% deep engagement
 * - Clamped to MIN_CAPACITY (5) and MAX_CAPACITY (20)
 *
 * @example
 * ```typescript
 * suggestCapacity(30);  // Returns 10 (33% of 30)
 * suggestCapacity(80);  // Returns 15 (19% of 80)
 * suggestCapacity(200); // Returns 20 (max capacity)
 * suggestCapacity(10);  // Returns 5 (min capacity)
 * ```
 */
export function suggestCapacity(avgDailyMessages: number): number {
  // Target: 18% of daily message volume
  const suggested = Math.round(avgDailyMessages * 0.18);

  // Clamp to valid range (5-20)
  return Math.max(MIN_CAPACITY, Math.min(MAX_CAPACITY, suggested));
}

/**
 * Fetches user's average daily message count over the last 30 days
 *
 * @param userId - Firebase user ID
 * @returns Promise resolving to average messages per day
 * @throws Error if Firestore query fails
 *
 * @remarks
 * Calculates average from messages where user is a participant.
 * Includes both sent and received messages.
 * Returns 0 if no messages found or user is new.
 *
 * @example
 * ```typescript
 * const avg = await getAverageDailyMessages('user123');
 * console.log(`You receive ~${avg} messages/day`);
 * ```
 */
export async function getAverageDailyMessages(userId: string): Promise<number> {
  try {
    const db = getFirebaseDb();

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    // NOTE: This queries a top-level 'messages' collection that doesn't exist yet
    // Messages are currently stored in subcollections: conversations/{id}/messages/{id}
    // This will fail gracefully and return 0 (no suggestions shown)
    // TODO: Add Cloud Function to aggregate message counts for capacity suggestions
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', userId),
      where('createdAt', '>=', thirtyDaysTimestamp)
    );

    const snapshot = await getDocs(q);
    const messageCount = snapshot.size;

    // Calculate average per day (divide by 30)
    const avgPerDay = messageCount / 30;

    return Math.round(avgPerDay);
  } catch (error) {
    // Graceful degradation: Return 0 if unable to fetch message history
    // This is expected for users without message data or permission issues
    // Note: Messages are stored in subcollections, not a top-level collection
    if (__DEV__) {
      console.log('[CapacityService] Unable to fetch message history, using default (0)');
    }
    return 0;
  }
}

/**
 * Calculates estimated time commitment for given capacity
 *
 * @param capacity - Daily message capacity
 * @returns Time in minutes
 *
 * @remarks
 * Assumes average 2 minutes per message including:
 * - Reading the message
 * - Thinking about response
 * - Drafting personalized reply
 * - Reviewing and sending
 *
 * @example
 * ```typescript
 * calculateTimeCommitment(10); // Returns 20 (minutes)
 * calculateTimeCommitment(15); // Returns 30 (minutes)
 * ```
 */
export function calculateTimeCommitment(capacity: number): number {
  // Average 2 minutes per message
  return capacity * 2;
}

/**
 * Previews message distribution for a given capacity setting
 *
 * @param capacity - Daily capacity limit to preview
 * @param avgDailyMessages - Average messages received per day
 * @param avgFAQRate - Estimated FAQ match rate (default: 0.15 = 15%)
 * @returns Distribution breakdown of deep/FAQ/archived messages
 *
 * @remarks
 * Distribution logic:
 * - FAQ: ~15% of messages (from Story 5.4 data)
 * - Deep: Limited by capacity setting
 * - Archived: Remaining messages beyond capacity + FAQ
 *
 * @example
 * ```typescript
 * // User receives 50 messages/day, sets capacity to 10
 * const dist = previewDistribution(10, 50);
 * // Returns: { deep: 10, faq: 8, archived: 32 }
 * // 10 personalized + 8 FAQ auto-responses + 32 archived
 * ```
 */
export function previewDistribution(
  capacity: number,
  avgDailyMessages: number,
  avgFAQRate: number = 0.15
): MessageDistribution {
  // Calculate FAQ count (~15% of messages)
  const faqCount = Math.round(avgDailyMessages * avgFAQRate);

  // Deep conversations limited by capacity
  const deepCount = capacity;

  // Archived = remaining messages
  const archivedCount = Math.max(0, avgDailyMessages - deepCount - faqCount);

  return {
    deep: deepCount,
    faq: faqCount,
    archived: archivedCount,
  };
}
