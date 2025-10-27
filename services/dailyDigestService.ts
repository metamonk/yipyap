/**
 * Daily Digest service for managing daily agent execution summaries
 *
 * @remarks
 * This service handles daily digest operations including:
 * - Retrieving daily digest summaries
 * - Formatting digest summaries for display
 * - Real-time subscription to digest updates
 * Never access Firestore directly from components - always use this service layer.
 *
 * @module services/dailyDigestService
 */

import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit as firestoreLimit,
  FirestoreError,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './firebase';
import type { DailyDigest } from '@/types/ai';

/**
 * Message data structure used for populating digest arrays
 * @internal
 */
interface DigestMessageData {
  messageId: string;
  conversationId: string;
  senderName: string;
  messagePreview: string;
  category: string;
  actionTaken: 'auto_responded' | 'draft_created' | 'pending_review';
  draftResponse?: string;
  faqTemplateId?: string;
}

/**
 * Formats a digest summary from counts
 *
 * @param handled - Number of messages auto-handled
 * @param needReview - Number of messages needing review
 * @returns Formatted summary string (e.g., "10 handled, 5 need review")
 *
 * @example
 * ```typescript
 * const summary = formatDigestSummary(10, 5);
 * console.log(summary); // "10 handled, 5 need review"
 * ```
 */
export function formatDigestSummary(handled: number, needReview: number): string {
  return `${handled} handled, ${needReview} need review`;
}

/**
 * Retrieves the most recent daily digest for the current user
 *
 * @param userId - User ID to fetch digest for (optional, defaults to current user)
 * @returns Promise resolving to the most recent digest, or null if none exists
 * @throws {FirebaseError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const digest = await getDailyDigest();
 * if (digest) {
 *   console.log(digest.summary.summaryText); // "10 handled, 5 need review"
 * }
 * ```
 */
export async function getDailyDigest(userId?: string): Promise<DailyDigest | null> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access daily digest');
    }

    const uid = userId || currentUser!.uid;
    const digestsQuery = query(
      collection(db, 'users', uid, 'daily_digests'),
      orderBy('date', 'desc'),
      firestoreLimit(1)
    );

    const querySnapshot = await getDocs(digestsQuery);

    if (querySnapshot.empty) {
      return null;
    }

    const digestData = querySnapshot.docs[0].data() as DailyDigest;

    // If arrays are empty but counts are non-zero, populate them from message queries
    // This handles the case where backend created digest with counts but not message arrays
    if (
      (digestData.pendingMessages.length === 0 && digestData.summary.totalNeedingReview > 0) ||
      (digestData.handledMessages.length === 0 && digestData.summary.totalHandled > 0)
    ) {
      console.log('[DailyDigest] Populating message arrays from metadata queries...');

      // Query for pending messages (marked with pendingReview: true)
      if (digestData.pendingMessages.length === 0 && digestData.summary.totalNeedingReview > 0) {
        const pendingMessages = await queryMessagesByMetadata(uid, 'pendingReview', true);
        digestData.pendingMessages = pendingMessages;
      }

      // Query for handled messages (marked with autoResponseSent: true)
      if (digestData.handledMessages.length === 0 && digestData.summary.totalHandled > 0) {
        const handledMessages = await queryMessagesByMetadata(uid, 'autoResponseSent', true);
        digestData.handledMessages = handledMessages;
      }
    }

    return digestData;
  } catch (error) {
    console.error('Error fetching daily digest:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load daily digest: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get the latest Meaningful 10 daily digest for a user
 *
 * @param userId - Optional user ID (defaults to current user)
 * @returns The latest Meaningful 10 digest with priority tiers, or null if none exists
 *
 * @remarks
 * Returns a digest with three priority tiers:
 * - High Priority (top 3): Respond today
 * - Medium Priority (2-7 messages): Respond this week
 * - Auto-handled: FAQ responses + archived conversations
 */
export async function getMeaningful10Digest(userId?: string): Promise<import('../types/ai').Meaningful10Digest | null> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access meaningful 10 digest');
    }

    const uid = userId || currentUser!.uid;
    const digestsQuery = query(
      collection(db, 'users', uid, 'meaningful10_digests'),
      orderBy('date', 'desc'),
      firestoreLimit(1)
    );

    const querySnapshot = await getDocs(digestsQuery);

    if (querySnapshot.empty) {
      return null;
    }

    const digestData = querySnapshot.docs[0].data() as import('../types/ai').Meaningful10Digest;
    return digestData;
  } catch (error) {
    console.error('Error fetching meaningful 10 digest:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load meaningful 10 digest: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Queries messages across conversations by metadata field
 * @internal Helper function for getDailyDigest
 *
 * @remarks
 * Uses a simplified query without orderBy to avoid requiring composite indexes.
 * Filters and sorts results in-memory instead.
 */
async function queryMessagesByMetadata(
  userId: string,
  metadataKey: string,
  metadataValue: boolean | string | number
): Promise<DigestMessageData[]> {
  try {
    const db = getFirebaseDb();

    // Get user's conversations
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', userId),
      firestoreLimit(20) // Limit conversations to avoid timeouts
    );
    const conversationsSnap = await getDocs(conversationsQuery);

    const messages: Array<DigestMessageData & { timestamp: unknown }> = [];

    // Query messages in each conversation
    // Note: Using simple where() without orderBy to avoid requiring composite indexes
    for (const convDoc of conversationsSnap.docs) {
      try {
        const messagesQuery = query(
          collection(db, 'conversations', convDoc.id, 'messages'),
          where(`metadata.${metadataKey}`, '==', metadataValue),
          firestoreLimit(20) // Reasonable limit per conversation
        );

        const messagesSnap = await getDocs(messagesQuery);

        messagesSnap.forEach((msgDoc) => {
          const msgData = msgDoc.data();

          // Only include messages with actual text
          if (msgData.text && typeof msgData.text === 'string') {
            // Determine actionTaken based on metadata
            let actionTaken: 'auto_responded' | 'draft_created' | 'pending_review';
            if (metadataKey === 'autoResponseSent' && msgData.metadata?.faqTemplateId) {
              actionTaken = 'auto_responded';
            } else if (msgData.metadata?.suggestedResponse) {
              actionTaken = 'draft_created';
            } else {
              actionTaken = 'pending_review';
            }

            messages.push({
              messageId: msgDoc.id,
              conversationId: convDoc.id,
              senderName: msgData.senderName || 'Unknown',
              messagePreview: msgData.text.substring(0, 100),
              category: msgData.metadata?.category || 'general',
              actionTaken,
              draftResponse: msgData.metadata?.suggestedResponse || undefined,
              faqTemplateId: msgData.metadata?.faqTemplateId || undefined,
              timestamp: msgData.timestamp,
            });
          }
        });
      } catch (convError) {
        // Log error but continue with other conversations
        console.warn(`Error querying messages in conversation ${convDoc.id}:`, convError);
      }
    }

    // Sort messages by timestamp in-memory (newest first)
    messages.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.seconds - a.timestamp.seconds;
    });

    // Remove timestamp field from final results (used only for sorting)
    return messages.map(({ timestamp: _timestamp, ...rest }) => rest);
  } catch (error) {
    console.error(`Error querying messages by metadata (${metadataKey}):`, error);
    return [];
  }
}

/**
 * Retrieves a specific daily digest by ID
 *
 * @param digestId - Digest document ID
 * @param userId - User ID (optional, defaults to current user)
 * @returns Promise resolving to the digest, or null if not found
 * @throws {FirebaseError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const digest = await getDailyDigestById('digest_123');
 * ```
 */
export async function getDailyDigestById(
  digestId: string,
  userId?: string
): Promise<DailyDigest | null> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access daily digest');
    }

    const uid = userId || currentUser!.uid;
    const digestDoc = doc(db, 'users', uid, 'daily_digests', digestId);
    const digestSnapshot = await getDoc(digestDoc);

    if (!digestSnapshot.exists()) {
      return null;
    }

    return digestSnapshot.data() as DailyDigest;
  } catch (error) {
    console.error('Error fetching daily digest by ID:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load daily digest: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Retrieves recent daily digests for the current user
 *
 * @param limitCount - Maximum number of digests to retrieve (default: 30)
 * @param userId - User ID (optional, defaults to current user)
 * @returns Promise resolving to array of recent digests
 * @throws {FirebaseError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const recentDigests = await getRecentDigests(7); // Last 7 days
 * ```
 */
export async function getRecentDigests(
  limitCount: number = 30,
  userId?: string
): Promise<DailyDigest[]> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access daily digests');
    }

    const uid = userId || currentUser!.uid;
    const digestsQuery = query(
      collection(db, 'users', uid, 'daily_digests'),
      orderBy('date', 'desc'),
      firestoreLimit(limitCount)
    );

    const querySnapshot = await getDocs(digestsQuery);

    return querySnapshot.docs.map((doc) => doc.data() as DailyDigest);
  } catch (error) {
    console.error('Error fetching recent digests:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load recent digests: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Subscribes to real-time updates for the most recent daily digest
 *
 * @param callback - Function called when digest changes
 * @param userId - User ID to subscribe for (optional, defaults to current user)
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirestoreError} When Firestore listener setup fails
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToDailyDigests((digests) => {
 *   console.log('Latest digest:', digests[0]);
 * });
 *
 * // Later, stop listening
 * unsubscribe();
 * ```
 */
export function subscribeToDailyDigests(
  callback: (digests: DailyDigest[]) => void,
  userId?: string
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to subscribe to daily digests');
    }

    const uid = userId || currentUser!.uid;
    const digestsQuery = query(
      collection(db, 'users', uid, 'daily_digests'),
      orderBy('date', 'desc'),
      firestoreLimit(30) // Last 30 days
    );

    return onSnapshot(
      digestsQuery,
      (snapshot) => {
        const digests = snapshot.docs.map((doc) => doc.data() as DailyDigest);
        callback(digests);
      },
      (error) => {
        console.error('Error in daily digest subscription:', error);
        throw new Error(`Failed to listen for digest updates: ${error.message}`);
      }
    );
  } catch (error) {
    console.error('Error setting up daily digest subscription:', error);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for a specific daily digest
 *
 * @param digestId - Digest document ID to subscribe to
 * @param callback - Function called when digest changes
 * @param userId - User ID (optional, defaults to current user)
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirestoreError} When Firestore listener setup fails
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToDigest('digest_123', (digest) => {
 *   if (digest) {
 *     console.log('Digest updated:', digest);
 *   }
 * });
 * ```
 */
export function subscribeToDigest(
  digestId: string,
  callback: (digest: DailyDigest | null) => void,
  userId?: string
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to subscribe to digest');
    }

    const uid = userId || currentUser!.uid;
    const digestDoc = doc(db, 'users', uid, 'daily_digests', digestId);

    return onSnapshot(
      digestDoc,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }

        callback(snapshot.data() as DailyDigest);
      },
      (error) => {
        console.error('Error in digest subscription:', error);
        throw new Error(`Failed to listen for digest updates: ${error.message}`);
      }
    );
  } catch (error) {
    console.error('Error setting up digest subscription:', error);
    throw error;
  }
}
