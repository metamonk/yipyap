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
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './firebase';
import type { DailyDigest } from '@/types/ai';

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

    return querySnapshot.docs[0].data() as DailyDigest;
  } catch (error) {
    console.error('Error fetching daily digest:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load daily digest: ${error.message}`);
    }
    throw error;
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
