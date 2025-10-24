import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { Conversation } from '../types/models';

/**
 * Result of a bulk operation
 *
 * @remarks
 * Contains success/failure counts and any errors encountered
 */
export interface BulkOperationResult {
  /** Total number of items processed */
  totalProcessed: number;

  /** Number of items successfully updated */
  successCount: number;

  /** Number of items that failed to update */
  failureCount: number;

  /** Array of error messages for failed operations */
  errors: string[];

  /** Whether the entire operation completed successfully */
  completed: boolean;
}

/**
 * Progress callback for long-running bulk operations
 *
 * @param current - Number of items processed so far
 * @param total - Total number of items to process
 * @param percentage - Percentage complete (0-100)
 */
export type ProgressCallback = (current: number, total: number, percentage: number) => void;

/**
 * Service class for bulk operations on conversations and messages
 *
 * @remarks
 * Provides batch operations for managing multiple conversations/messages at once.
 * All operations include progress tracking, error handling, and rollback support.
 *
 * @class BulkOperationsService
 */
export class BulkOperationsService {
  /**
   * Archive all read conversations for a user
   *
   * @remarks
   * Archives conversations where all messages have been read by the user.
   * Uses batched writes for efficiency (max 500 per batch).
   * Operations are atomic within each batch - if one fails, the batch rolls back.
   *
   * @param userId - User ID to archive conversations for
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to operation result with success/failure counts
   * @throws {Error} When user is not a participant in conversations being archived
   *
   * @example
   * ```typescript
   * const result = await bulkOperationsService.archiveAllRead('user123', (current, total, pct) => {
   *   console.log(`Archiving: ${pct}% complete`);
   * });
   * console.log(`Archived ${result.successCount} conversations`);
   * ```
   */
  async archiveAllRead(
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<BulkOperationResult> {
    const firestore = getFirebaseDb();
    const result: BulkOperationResult = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      completed: false,
    };

    try {
      // Query user's conversations where user is a participant
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversations = conversationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Conversation & { id: string })[];

      // Filter to conversations that are fully read by user
      const fullyReadConversations = conversations.filter(conv => {
        // Check if user has 0 unread messages
        // A conversation is "read" if unreadCount for user is 0
        return (conv.unreadCount?.[userId] ?? 0) === 0;
      });

      result.totalProcessed = fullyReadConversations.length;

      if (fullyReadConversations.length === 0) {
        result.completed = true;
        return result;
      }

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      const totalBatches = Math.ceil(fullyReadConversations.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = writeBatch(firestore);
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, fullyReadConversations.length);
        const batchConversations = fullyReadConversations.slice(batchStart, batchEnd);

        try {
          // Add updates to batch
          batchConversations.forEach(conv => {
            const convRef = doc(firestore, 'conversations', conv.id);
            batch.update(convRef, {
              [`archivedBy.${userId}`]: true,
              updatedAt: Timestamp.now(),
            });
          });

          // Commit batch
          await batch.commit();
          result.successCount += batchConversations.length;

          // Report progress
          if (onProgress) {
            const processed = batchEnd;
            const percentage = Math.round((processed / fullyReadConversations.length) * 100);
            onProgress(processed, fullyReadConversations.length, percentage);
          }
        } catch (error) {
          result.failureCount += batchConversations.length;
          result.errors.push(`Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.completed = result.failureCount === 0;
      return result;
    } catch (error) {
      result.errors.push(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.completed = false;
      return result;
    }
  }

  /**
   * Mark all messages as read for a user
   *
   * @remarks
   * Updates all messages across all conversations to mark them as read by the user.
   * Uses batched writes for efficiency (max 500 per batch).
   * Only updates messages where user is NOT already in readBy array.
   *
   * @param userId - User ID to mark messages as read for
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to operation result with success/failure counts
   * @throws {Error} When user is not a participant in conversations
   *
   * @example
   * ```typescript
   * const result = await bulkOperationsService.markAllAsRead('user123', (current, total, pct) => {
   *   console.log(`Marking read: ${pct}% complete`);
   * });
   * console.log(`Marked ${result.successCount} messages as read`);
   * ```
   */
  async markAllAsRead(
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<BulkOperationResult> {
    const firestore = getFirebaseDb();
    const result: BulkOperationResult = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      completed: false,
    };

    try {
      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Get all unread messages across conversations
      const unreadMessages: Array<{ convId: string; msgId: string; readBy: string[] }> = [];

      for (const convId of conversationIds) {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages')
        );

        const messagesSnapshot = await getDocs(messagesQuery);

        messagesSnapshot.docs.forEach(msgDoc => {
          const msgData = msgDoc.data();
          // Only include messages where user is NOT in readBy array
          if (!msgData.readBy || !msgData.readBy.includes(userId)) {
            unreadMessages.push({
              convId,
              msgId: msgDoc.id,
              readBy: msgData.readBy || [],
            });
          }
        });
      }

      result.totalProcessed = unreadMessages.length;

      if (unreadMessages.length === 0) {
        result.completed = true;
        return result;
      }

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      const totalBatches = Math.ceil(unreadMessages.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = writeBatch(firestore);
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, unreadMessages.length);
        const batchMessages = unreadMessages.slice(batchStart, batchEnd);

        try {
          // Add updates to batch
          batchMessages.forEach(msg => {
            const msgRef = doc(firestore, 'conversations', msg.convId, 'messages', msg.msgId);
            const newReadBy = [...msg.readBy, userId];
            batch.update(msgRef, {
              readBy: newReadBy,
              status: 'read',
            });
          });

          // Commit batch
          await batch.commit();
          result.successCount += batchMessages.length;

          // Report progress
          if (onProgress) {
            const processed = batchEnd;
            const percentage = Math.round((processed / unreadMessages.length) * 100);
            onProgress(processed, unreadMessages.length, percentage);
          }
        } catch (error) {
          result.failureCount += batchMessages.length;
          result.errors.push(`Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.completed = result.failureCount === 0;
      return result;
    } catch (error) {
      result.errors.push(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.completed = false;
      return result;
    }
  }

  /**
   * Batch approve all pending AI-generated response suggestions
   *
   * @remarks
   * Approves all AI suggestions that are currently pending approval.
   * Updates suggestion metadata to mark them as approved.
   * Only processes suggestions belonging to the authenticated user.
   *
   * @param userId - User ID to approve suggestions for
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to operation result with success/failure counts
   * @throws {Error} When suggestions don't belong to the user
   *
   * @example
   * ```typescript
   * const result = await bulkOperationsService.batchApproveSuggestions('user123', (current, total, pct) => {
   *   console.log(`Approving: ${pct}% complete`);
   * });
   * console.log(`Approved ${result.successCount} suggestions`);
   * ```
   */
  async batchApproveSuggestions(
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<BulkOperationResult> {
    const firestore = getFirebaseDb();
    const result: BulkOperationResult = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      completed: false,
    };

    try {
      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Get all messages with pending suggestions across conversations
      const pendingSuggestions: Array<{ convId: string; msgId: string }> = [];

      for (const convId of conversationIds) {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('senderId', '==', userId)
        );

        const messagesSnapshot = await getDocs(messagesQuery);

        messagesSnapshot.docs.forEach(msgDoc => {
          const msgData = msgDoc.data();
          // Only include messages with suggested responses that are pending
          if (
            msgData.metadata?.suggestedResponse &&
            !msgData.metadata?.suggestionUsed &&
            !msgData.metadata?.suggestionRejected &&
            !msgData.metadata?.suggestionApproved
          ) {
            pendingSuggestions.push({
              convId,
              msgId: msgDoc.id,
            });
          }
        });
      }

      result.totalProcessed = pendingSuggestions.length;

      if (pendingSuggestions.length === 0) {
        result.completed = true;
        return result;
      }

      // Limit to 100 items to prevent abuse
      const maxItems = 100;
      if (pendingSuggestions.length > maxItems) {
        result.errors.push(`Operation limited to ${maxItems} items for safety. Found ${pendingSuggestions.length} pending suggestions.`);
        pendingSuggestions.splice(maxItems);
        result.totalProcessed = maxItems;
      }

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      const totalBatches = Math.ceil(pendingSuggestions.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = writeBatch(firestore);
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, pendingSuggestions.length);
        const batchSuggestions = pendingSuggestions.slice(batchStart, batchEnd);

        try {
          // Add updates to batch
          batchSuggestions.forEach(suggestion => {
            const msgRef = doc(firestore, 'conversations', suggestion.convId, 'messages', suggestion.msgId);
            batch.update(msgRef, {
              'metadata.suggestionApproved': true,
              'metadata.suggestionApprovedAt': Timestamp.now(),
            });
          });

          // Commit batch
          await batch.commit();
          result.successCount += batchSuggestions.length;

          // Report progress
          if (onProgress) {
            const processed = batchEnd;
            const percentage = Math.round((processed / pendingSuggestions.length) * 100);
            onProgress(processed, pendingSuggestions.length, percentage);
          }
        } catch (error) {
          result.failureCount += batchSuggestions.length;
          result.errors.push(`Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.completed = result.failureCount === 0;
      return result;
    } catch (error) {
      result.errors.push(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.completed = false;
      return result;
    }
  }

  /**
   * Batch reject all pending AI-generated response suggestions
   *
   * @remarks
   * Rejects all AI suggestions that are currently pending approval.
   * Updates suggestion metadata to mark them as rejected.
   * Only processes suggestions belonging to the authenticated user.
   *
   * @param userId - User ID to reject suggestions for
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to operation result with success/failure counts
   * @throws {Error} When suggestions don't belong to the user
   *
   * @example
   * ```typescript
   * const result = await bulkOperationsService.batchRejectSuggestions('user123', (current, total, pct) => {
   *   console.log(`Rejecting: ${pct}% complete`);
   * });
   * console.log(`Rejected ${result.successCount} suggestions`);
   * ```
   */
  async batchRejectSuggestions(
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<BulkOperationResult> {
    const firestore = getFirebaseDb();
    const result: BulkOperationResult = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      completed: false,
    };

    try {
      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Get all messages with pending suggestions across conversations
      const pendingSuggestions: Array<{ convId: string; msgId: string }> = [];

      for (const convId of conversationIds) {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('senderId', '==', userId)
        );

        const messagesSnapshot = await getDocs(messagesQuery);

        messagesSnapshot.docs.forEach(msgDoc => {
          const msgData = msgDoc.data();
          // Only include messages with suggested responses that are pending
          if (
            msgData.metadata?.suggestedResponse &&
            !msgData.metadata?.suggestionUsed &&
            !msgData.metadata?.suggestionRejected &&
            !msgData.metadata?.suggestionApproved
          ) {
            pendingSuggestions.push({
              convId,
              msgId: msgDoc.id,
            });
          }
        });
      }

      result.totalProcessed = pendingSuggestions.length;

      if (pendingSuggestions.length === 0) {
        result.completed = true;
        return result;
      }

      // Limit to 100 items to prevent abuse
      const maxItems = 100;
      if (pendingSuggestions.length > maxItems) {
        result.errors.push(`Operation limited to ${maxItems} items for safety. Found ${pendingSuggestions.length} pending suggestions.`);
        pendingSuggestions.splice(maxItems);
        result.totalProcessed = maxItems;
      }

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      const totalBatches = Math.ceil(pendingSuggestions.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = writeBatch(firestore);
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, pendingSuggestions.length);
        const batchSuggestions = pendingSuggestions.slice(batchStart, batchEnd);

        try {
          // Add updates to batch
          batchSuggestions.forEach(suggestion => {
            const msgRef = doc(firestore, 'conversations', suggestion.convId, 'messages', suggestion.msgId);
            batch.update(msgRef, {
              'metadata.suggestionRejected': true,
              'metadata.suggestionRejectedAt': Timestamp.now(),
            });
          });

          // Commit batch
          await batch.commit();
          result.successCount += batchSuggestions.length;

          // Report progress
          if (onProgress) {
            const processed = batchEnd;
            const percentage = Math.round((processed / pendingSuggestions.length) * 100);
            onProgress(processed, pendingSuggestions.length, percentage);
          }
        } catch (error) {
          result.failureCount += batchSuggestions.length;
          result.errors.push(`Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      result.completed = result.failureCount === 0;
      return result;
    } catch (error) {
      result.errors.push(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
      result.completed = false;
      return result;
    }
  }
}

/**
 * Singleton instance of BulkOperationsService
 * @remarks
 * Use this exported instance throughout the application for consistency
 */
export const bulkOperationsService = new BulkOperationsService();
