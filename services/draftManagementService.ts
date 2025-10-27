/**
 * Draft Management Service for Auto-Save Functionality (Story 6.2)
 *
 * @remarks
 * This service handles all draft persistence operations including auto-save,
 * restoration, history tracking, and cleanup.
 *
 * **Features:**
 * - Auto-save with 5-second debounce
 * - Draft restoration on conversation return
 * - Draft history tracking (multiple versions)
 * - Automatic cleanup after send/discard
 * - 7-day TTL expiration
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { MessageDraft } from '../types/ai';

/**
 * Result from draft save operation
 * @interface
 */
export interface DraftSaveResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Saved draft ID (if successful) */
  draftId?: string;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Result from draft restoration operation
 * @interface
 */
export interface DraftRestoreResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Restored draft (if successful) */
  draft?: MessageDraft;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Result from draft history retrieval
 * @interface
 */
export interface DraftHistoryResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Array of draft versions (if successful) */
  drafts?: MessageDraft[];

  /** Error message if operation failed */
  error?: string;
}

/**
 * Draft Management Service Class
 *
 * @remarks
 * Provides client-side draft persistence operations.
 * All drafts are stored in conversations/{conversationId}/message_drafts/{draftId}.
 *
 * @example
 * ```typescript
 * import { draftManagementService } from '@/services/draftManagementService';
 *
 * // Save a draft
 * const result = await draftManagementService.saveDraft(
 *   'conv123',
 *   'msg456',
 *   'This is my edited draft text',
 *   85,
 *   1
 * );
 *
 * // Restore active draft
 * const restoreResult = await draftManagementService.restoreDraft(
 *   'conv123',
 *   'msg456'
 * );
 * ```
 */
export class DraftManagementService {
  private debouncedSaves: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Saves a draft to Firestore with debouncing
   *
   * @param conversationId - The conversation ID
   * @param messageId - The message ID this draft responds to
   * @param draftText - The current draft text
   * @param confidence - AI confidence score (0-100)
   * @param version - Draft version number
   * @param debounceMs - Debounce delay in milliseconds (default: 5000)
   * @returns Promise resolving to save result
   *
   * @example
   * ```typescript
   * const result = await draftManagementService.saveDraft(
   *   'conv123',
   *   'msg456',
   *   'My edited draft',
   *   85,
   *   1
   * );
   *
   * if (result.success) {
   *   console.log('Draft saved:', result.draftId);
   * }
   * ```
   */
  async saveDraft(
    conversationId: string,
    messageId: string,
    draftText: string,
    confidence: number,
    version: number,
    debounceMs: number = 5000
  ): Promise<DraftSaveResult> {
    return new Promise((resolve) => {
      // Generate debounce key
      const debounceKey = `${conversationId}_${messageId}`;

      // Clear existing debounced save for this draft
      const existingTimeout = this.debouncedSaves.get(debounceKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set up new debounced save
      const timeout = setTimeout(async () => {
        this.debouncedSaves.delete(debounceKey);

        try {
          const db = getFirebaseDb();

          // Deactivate any existing active drafts for this message
          await this.deactivatePreviousDrafts(conversationId, messageId);

          // Generate draft ID
          const draftId = `draft_${messageId}_v${version}_${Date.now()}`;

          // Calculate expiration timestamp (7 days from now)
          const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

          // Create draft document
          const draftData: Omit<MessageDraft, 'id'> = {
            messageId,
            conversationId,
            draftText,
            confidence,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            version,
            isActive: true,
            expiresAt,
          };

          // Save to Firestore
          const draftRef = doc(db, 'conversations', conversationId, 'message_drafts', draftId);
          await setDoc(draftRef, draftData);

          resolve({
            success: true,
            draftId,
          });
        } catch (error) {
          console.error('[DraftManagementService] Error saving draft:', error);
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save draft',
          });
        }
      }, debounceMs);

      this.debouncedSaves.set(debounceKey, timeout);

      // If debounce is 0, resolve immediately with pending status
      if (debounceMs === 0) {
        resolve({
          success: true,
          draftId: 'pending',
        });
      }
    });
  }

  /**
   * Restores the active draft for a message
   *
   * @param conversationId - The conversation ID
   * @param messageId - The message ID
   * @returns Promise resolving to restore result
   *
   * @example
   * ```typescript
   * const result = await draftManagementService.restoreDraft('conv123', 'msg456');
   *
   * if (result.success && result.draft) {
   *   console.log('Restored draft:', result.draft.draftText);
   * }
   * ```
   */
  async restoreDraft(conversationId: string, messageId: string): Promise<DraftRestoreResult> {
    try {
      const db = getFirebaseDb();

      // Query for active draft
      const draftsRef = collection(db, 'conversations', conversationId, 'message_drafts');
      const q = query(
        draftsRef,
        where('messageId', '==', messageId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return {
          success: true,
          draft: undefined,
        };
      }

      // Get the most recent active draft
      const draftDoc = querySnapshot.docs[0];
      const draftData = draftDoc.data() as Omit<MessageDraft, 'id'>;

      const draft: MessageDraft = {
        id: draftDoc.id,
        ...draftData,
      };

      return {
        success: true,
        draft,
      };
    } catch (error) {
      console.error('[DraftManagementService] Error restoring draft:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore draft',
      };
    }
  }

  /**
   * Retrieves draft history for a message
   *
   * @param conversationId - The conversation ID
   * @param messageId - The message ID
   * @returns Promise resolving to draft history result
   *
   * @example
   * ```typescript
   * const result = await draftManagementService.getDraftHistory('conv123', 'msg456');
   *
   * if (result.success && result.drafts) {
   *   console.log('Found', result.drafts.length, 'draft versions');
   * }
   * ```
   */
  async getDraftHistory(conversationId: string, messageId: string): Promise<DraftHistoryResult> {
    try {
      const db = getFirebaseDb();

      // Query for all drafts for this message
      const draftsRef = collection(db, 'conversations', conversationId, 'message_drafts');
      const q = query(draftsRef, where('messageId', '==', messageId), orderBy('version', 'asc'));

      const querySnapshot = await getDocs(q);

      const drafts: MessageDraft[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<MessageDraft, 'id'>),
      }));

      return {
        success: true,
        drafts,
      };
    } catch (error) {
      console.error('[DraftManagementService] Error getting draft history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get draft history',
      };
    }
  }

  /**
   * Clears all drafts for a message (after send or discard)
   *
   * @param conversationId - The conversation ID
   * @param messageId - The message ID
   * @returns Promise resolving to success status
   *
   * @example
   * ```typescript
   * const result = await draftManagementService.clearDrafts('conv123', 'msg456');
   *
   * if (result.success) {
   *   console.log('All drafts cleared');
   * }
   * ```
   */
  async clearDrafts(conversationId: string, messageId: string): Promise<DraftSaveResult> {
    try {
      const db = getFirebaseDb();

      // Clear any pending debounced saves
      const debounceKey = `${conversationId}_${messageId}`;
      const existingTimeout = this.debouncedSaves.get(debounceKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.debouncedSaves.delete(debounceKey);
      }

      // Query for all drafts for this message
      const draftsRef = collection(db, 'conversations', conversationId, 'message_drafts');
      const q = query(draftsRef, where('messageId', '==', messageId));

      const querySnapshot = await getDocs(q);

      // Delete all draft documents
      const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[DraftManagementService] Error clearing drafts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear drafts',
      };
    }
  }

  /**
   * Cancels any pending debounced saves
   *
   * @param conversationId - The conversation ID
   * @param messageId - The message ID
   *
   * @example
   * ```typescript
   * draftManagementService.cancelDebouncedSave('conv123', 'msg456');
   * ```
   */
  cancelDebouncedSave(conversationId: string, messageId: string): void {
    const debounceKey = `${conversationId}_${messageId}`;
    const existingTimeout = this.debouncedSaves.get(debounceKey);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.debouncedSaves.delete(debounceKey);
    }
  }

  /**
   * Deactivates all previous drafts for a message
   *
   * @param conversationId - The conversation ID
   * @param messageId - The message ID
   * @private
   */
  private async deactivatePreviousDrafts(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    try {
      const db = getFirebaseDb();

      // Query for active drafts
      const draftsRef = collection(db, 'conversations', conversationId, 'message_drafts');
      const q = query(
        draftsRef,
        where('messageId', '==', messageId),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);

      // Deactivate all found drafts
      const updatePromises = querySnapshot.docs.map((doc) =>
        setDoc(doc.ref, { isActive: false }, { merge: true })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('[DraftManagementService] Error deactivating previous drafts:', error);
      // Don't throw - this is a best-effort operation
    }
  }
}

/**
 * Singleton instance of DraftManagementService
 * @constant
 */
export const draftManagementService = new DraftManagementService();
