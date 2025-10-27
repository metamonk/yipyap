/**
 * Undo Archive Service (Story 6.4)
 * @module services/undoArchiveService
 *
 * @remarks
 * Handles undo operations for auto-archived conversations.
 * Provides 24-hour window for undoing auto-archive operations.
 *
 * Features:
 * - Fetch active undo records (within 24 hours)
 * - Undo archive operation
 * - Automatic expiration after 24 hours
 * - Track undo analytics
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { UndoArchive } from '../types/ai';

/**
 * Fetches active undo records for a user (Story 6.4)
 *
 * @param userId - Creator user ID
 * @param limitCount - Maximum number of records to fetch (default: 50)
 * @returns Promise<UndoArchive[]> - Array of active undo records
 *
 * @remarks
 * Only returns undo records that:
 * - Belong to the user
 * - Have not expired (expiresAt > now)
 * - Have not been undone (canUndo === true)
 * - Sorted by archivedAt descending (most recent first)
 *
 * @example
 * ```typescript
 * const undoRecords = await fetchActiveUndoRecords('user123');
 * console.log(`Found ${undoRecords.length} active undo records`);
 * ```
 */
export async function fetchActiveUndoRecords(
  userId: string,
  limitCount: number = 50
): Promise<UndoArchive[]> {
  const firestore = getFirebaseDb();
  const now = Timestamp.now();

  // Query undo_archive collection for active records
  const undoArchiveRef = collection(firestore, 'undo_archive');
  const q = query(
    undoArchiveRef,
    where('userId', '==', userId),
    where('canUndo', '==', true),
    where('expiresAt', '>', now),
    orderBy('expiresAt', 'desc'),
    orderBy('archivedAt', 'desc'),
    firestoreLimit(limitCount)
  );

  const querySnapshot = await getDocs(q);

  const undoRecords: UndoArchive[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    undoRecords.push({
      id: docSnap.id,
      userId: data.userId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      archivedAt: data.archivedAt,
      expiresAt: data.expiresAt,
      boundaryMessageSent: data.boundaryMessageSent,
      canUndo: data.canUndo,
      undoneAt: data.undoneAt,
    });
  });

  return undoRecords;
}

/**
 * Undoes an auto-archive operation (Story 6.4)
 *
 * @param undoRecordId - Undo record ID
 * @param userId - Creator user ID (for security verification)
 * @returns Promise<boolean> - True if undo successful, false otherwise
 *
 * @remarks
 * Performs the following operations:
 * 1. Verifies undo record exists and belongs to user
 * 2. Checks if undo window is still valid (not expired)
 * 3. Checks if undo hasn't already been performed
 * 4. Un-archives the conversation
 * 5. Marks undo record as used (canUndo = false)
 * 6. Tracks undo analytics
 *
 * @example
 * ```typescript
 * const success = await undoArchive('undo_abc123', 'user123');
 * if (success) {
 *   console.log('Archive undone successfully');
 * } else {
 *   console.error('Failed to undo archive (expired or invalid)');
 * }
 * ```
 */
export async function undoArchive(undoRecordId: string, userId: string): Promise<boolean> {
  const firestore = getFirebaseDb();

  try {
    // Fetch undo record
    const undoRecordRef = doc(firestore, 'undo_archive', undoRecordId);
    const undoRecordSnap = await getDoc(undoRecordRef);

    if (!undoRecordSnap.exists()) {
      console.error(`Undo record not found: ${undoRecordId}`);
      return false;
    }

    const undoRecord = undoRecordSnap.data() as UndoArchive;

    // Security check: verify record belongs to user
    if (undoRecord.userId !== userId) {
      console.error(`Undo record ${undoRecordId} does not belong to user ${userId}`);
      return false;
    }

    // Check if already undone
    if (!undoRecord.canUndo) {
      console.log(`Undo record ${undoRecordId} has already been undone`);
      return false;
    }

    // Check if expired
    const now = Timestamp.now();
    if (undoRecord.expiresAt.toMillis() < now.toMillis()) {
      console.log(`Undo record ${undoRecordId} has expired`);
      return false;
    }

    // Un-archive conversation
    const conversationRef = doc(firestore, 'conversations', undoRecord.conversationId);
    await updateDoc(conversationRef, {
      [`archivedBy.${userId}`]: false,
      updatedAt: Timestamp.now(),
    });

    // Mark undo record as used
    await updateDoc(undoRecordRef, {
      canUndo: false,
      undoneAt: Timestamp.now(),
    });

    console.log(`[Undo Archive] Successfully undone archive for conversation: ${undoRecord.conversationId}`);
    return true;
  } catch (error) {
    console.error('[Undo Archive] Error undoing archive:', error);
    return false;
  }
}

/**
 * Checks if an undo record is still valid (Story 6.4)
 *
 * @param undoRecord - Undo record to check
 * @returns boolean - True if undo is still valid
 *
 * @remarks
 * Undo is valid if:
 * - canUndo is true (not already undone)
 * - expiresAt > now (within 24-hour window)
 *
 * @example
 * ```typescript
 * const undoRecords = await fetchActiveUndoRecords('user123');
 * const validRecords = undoRecords.filter(isUndoValid);
 * ```
 */
export function isUndoValid(undoRecord: UndoArchive): boolean {
  if (!undoRecord.canUndo) {
    return false;
  }

  const now = Timestamp.now();
  if (undoRecord.expiresAt.toMillis() < now.toMillis()) {
    return false;
  }

  return true;
}

/**
 * Calculates time remaining for undo (Story 6.4)
 *
 * @param undoRecord - Undo record
 * @returns number - Milliseconds remaining before expiration
 *
 * @remarks
 * Returns 0 if already expired.
 * Useful for displaying countdown timers in UI.
 *
 * @example
 * ```typescript
 * const msRemaining = getTimeRemainingForUndo(undoRecord);
 * const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
 * console.log(`${hoursRemaining} hours left to undo`);
 * ```
 */
export function getTimeRemainingForUndo(undoRecord: UndoArchive): number {
  const now = Timestamp.now();
  const remaining = undoRecord.expiresAt.toMillis() - now.toMillis();

  return Math.max(0, remaining);
}

/**
 * Formats time remaining as human-readable string (Story 6.4)
 *
 * @param msRemaining - Milliseconds remaining
 * @returns string - Human-readable time (e.g., "23h 45m", "45m", "5m")
 *
 * @example
 * ```typescript
 * const timeLeft = formatTimeRemaining(getTimeRemainingForUndo(undoRecord));
 * console.log(`Expires in ${timeLeft}`);
 * ```
 */
export function formatTimeRemaining(msRemaining: number): string {
  if (msRemaining <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
