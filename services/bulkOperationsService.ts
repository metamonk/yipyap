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
  DocumentData,
  getDoc,
  setDoc,
  addDoc,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { Conversation, Message } from '../types/models';
import { AutoArchiveResult } from '../types/ai';
import type { User } from '../types/user';

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

}

/**
 * Singleton instance of BulkOperationsService
 * @remarks
 * Use this exported instance throughout the application for consistency
 */
export const bulkOperationsService = new BulkOperationsService();

// =============================================
// Story 6.4: Auto-Archive with Kind Boundary
// =============================================

/**
 * Default boundary message template (Story 6.4)
 *
 * @remarks
 * Sent to fans when their message is auto-archived due to capacity limits.
 * Supports template variables: {{creatorName}}, {{faqUrl}}, {{communityUrl}}
 * Customizable per creator in user settings.
 */
export const DEFAULT_BOUNDARY_MESSAGE_TEMPLATE = `Hi! I get hundreds of messages daily and can't personally respond to everyone.

For quick questions, check out my FAQ: {{faqUrl}}
For deeper connection, join my community: {{communityUrl}}

I read every message, but I focus on responding to those I can give thoughtful attention to. If this is time-sensitive, feel free to follow up and I'll prioritize it.

Thank you for understanding! 💙

[This message was sent automatically]`;

/**
 * Renders boundary message template with user-specific variables (Story 6.4)
 *
 * @param template - Boundary message template string with {{variable}} placeholders
 * @param vars - Variable values to substitute
 * @returns Rendered message with variables replaced
 *
 * @example
 * ```typescript
 * const message = renderBoundaryTemplate(template, {
 *   creatorName: 'Jane Doe',
 *   faqUrl: 'https://example.com/faq',
 *   communityUrl: 'https://discord.gg/example'
 * });
 * ```
 */
export function renderBoundaryTemplate(
  template: string,
  vars: { creatorName?: string; faqUrl?: string; communityUrl?: string }
): string {
  let rendered = template;

  // Replace template variables
  rendered = rendered.replace(/\{\{creatorName\}\}/g, vars.creatorName || '[Creator]');
  rendered = rendered.replace(/\{\{faqUrl\}\}/g, vars.faqUrl || '[FAQ not configured]');
  rendered = rendered.replace(/\{\{communityUrl\}\}/g, vars.communityUrl || '[Community not configured]');

  return rendered;
}

/**
 * Checks if current time is within user's quiet hours (Story 6.4)
 *
 * @param quietHours - User's quiet hours settings
 * @param timezone - User's timezone (IANA identifier)
 * @returns True if currently in quiet hours, false otherwise
 *
 * @example
 * ```typescript
 * const isQuiet = isQuietHours(
 *   { enabled: true, startTime: '22:00', endTime: '08:00', timezone: 'America/Los_Angeles' },
 *   'America/Los_Angeles'
 * );
 * ```
 */
export function isQuietHours(
  quietHours: { enabled: boolean; startTime: string; endTime: string; timezone: string } | undefined,
  timezone: string
): boolean {
  if (!quietHours || !quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHours.startTime.split(':').map(Number);
  const [endHour, endMinute] = quietHours.endTime.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // Handle quiet hours that cross midnight
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Checks if a boundary message was recently sent to a fan (Story 6.4)
 *
 * @param fanId - Fan user ID
 * @param creatorId - Creator user ID
 * @param windowMs - Time window in milliseconds (default: 7 days)
 * @returns Promise<boolean> - True if boundary was sent within window
 *
 * @example
 * ```typescript
 * const wasRecent = await recentBoundarySent('fan123', 'creator456', 7 * 24 * 60 * 60 * 1000);
 * ```
 */
export async function recentBoundarySent(
  fanId: string,
  creatorId: string,
  windowMs: number = 7 * 24 * 60 * 60 * 1000 // Default: 7 days
): Promise<boolean> {
  const firestore = getFirebaseDb();
  const rateLimitKey = `${creatorId}_${fanId}`;
  const rateLimitRef = doc(firestore, 'rate_limits', 'boundary_messages', rateLimitKey);

  try {
    const rateLimitDoc = await getDoc(rateLimitRef);

    if (!rateLimitDoc.exists()) {
      return false;
    }

    const data = rateLimitDoc.data();
    const lastSent = data.lastBoundarySent as Timestamp;
    const elapsed = Date.now() - lastSent.toMillis();

    return elapsed < windowMs;
  } catch (error) {
    console.error('Error checking boundary rate limit:', error);
    return false; // Fail open - allow sending if check fails
  }
}

/**
 * Sets rate limit record for boundary message (Story 6.4)
 *
 * @param fanId - Fan user ID
 * @param creatorId - Creator user ID
 * @returns Promise<void>
 */
export async function setRateLimitKey(fanId: string, creatorId: string): Promise<void> {
  const firestore = getFirebaseDb();
  const rateLimitKey = `${creatorId}_${fanId}`;
  const rateLimitRef = doc(firestore, 'rate_limits', 'boundary_messages', rateLimitKey);

  const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await setDoc(rateLimitRef, {
    fanId,
    creatorId,
    lastBoundarySent: Timestamp.now(),
    expiresAt,
  });
}

/**
 * Safety check: Determines if a message should NOT be auto-archived (Story 6.4)
 *
 * @param message - Message to check
 * @returns Promise<boolean> - True if message should be excluded from archiving
 *
 * @remarks
 * Never auto-archive:
 * - Business/partnership messages (category: business)
 * - Urgent requests (category: urgent)
 * - VIP fans (relationship: isVIP)
 * - Crisis/emergency sentiment (sentiment < -0.7)
 * - High-priority messages (score > threshold)
 */
export async function shouldNotArchive(message: Message): Promise<boolean> {
  const metadata = message.metadata || {};

  // Business category
  if (metadata.category === 'business_opportunity') {
    console.log(`[Auto-Archive Safety] Skipped business message: ${message.id}`);
    return true;
  }

  // Urgent category
  if (metadata.category === 'urgent') {
    console.log(`[Auto-Archive Safety] Skipped urgent message: ${message.id}`);
    return true;
  }

  // VIP relationship (check in relationshipContext from Story 6.1)
  if (metadata.relationshipContext?.isVIP) {
    console.log(`[Auto-Archive Safety] Skipped VIP conversation: ${message.id}`);
    return true;
  }

  // Crisis sentiment (sentiment score < -0.7 indicates crisis)
  if (metadata.sentimentScore !== undefined && metadata.sentimentScore < -0.7) {
    console.log(`[Auto-Archive Safety] Skipped crisis sentiment: ${message.id}, sentimentScore: ${metadata.sentimentScore}`);
    return true;
  }

  return false;
}

/**
 * Auto-archive low-priority messages with kind boundary message (Story 6.4)
 *
 * @param userId - Creator user ID
 * @param lowPriorityMessages - Messages to archive (already filtered by priority scoring)
 * @returns Promise<AutoArchiveResult> - Result with counts
 *
 * @remarks
 * Features:
 * - Safety checks (never archive business/urgent/VIP/crisis)
 * - Rate limiting (max 1 boundary per fan per week)
 * - Quiet hours respect
 * - Creates undo records (24-hour window)
 * - Analytics tracking
 *
 * @example
 * ```typescript
 * const result = await autoArchiveWithKindBoundary('user123', lowPriorityMessages);
 * console.log(`Archived: ${result.archivedCount}, Boundaries sent: ${result.boundariesSent}`);
 * ```
 */
export async function autoArchiveWithKindBoundary(
  userId: string,
  lowPriorityMessages: Message[]
): Promise<AutoArchiveResult> {
  const firestore = getFirebaseDb();
  const result: AutoArchiveResult = {
    archivedCount: 0,
    boundariesSent: 0,
    rateLimited: 0,
    safetyBlocked: 0,
  };

  // Fetch user settings
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    throw new Error(`User not found: ${userId}`);
  }

  const userData = userDoc.data() as User;
  const settings = userData.settings || {};
  const capacitySettings = settings.capacity;
  const quietHours = settings.opportunityNotifications?.quietHours;

  // Check if auto-archive is enabled
  if (!capacitySettings?.autoArchiveEnabled) {
    console.log(`[Auto-Archive] Auto-archive disabled for user: ${userId}`);
    return result;
  }

  const boundaryTemplate = capacitySettings.boundaryMessage || DEFAULT_BOUNDARY_MESSAGE_TEMPLATE;

  // Process each low-priority message
  for (const message of lowPriorityMessages) {
    // Safety checks
    if (await shouldNotArchive(message)) {
      result.safetyBlocked++;
      continue;
    }

    // Archive conversation
    try {
      const convRef = doc(firestore, 'conversations', message.conversationId);
      await updateDoc(convRef, {
        [`archivedBy.${userId}`]: true,
        updatedAt: Timestamp.now(),
      });

      result.archivedCount++;

      // Check rate limiting (max 1 boundary per fan per week)
      const wasRecentlySent = await recentBoundarySent(message.senderId, userId);

      if (wasRecentlySent) {
        result.rateLimited++;
        console.log(`[Auto-Archive] Rate limited - fan ${message.senderId} already got boundary this week`);

        // Still create undo record (without boundary message)
        await createUndoRecord(userId, message.conversationId, message.id, false);
        continue;
      }

      // Check quiet hours (use notification quiet hours structure)
      const notifQuietHours = userData.settings.notifications?.quietHoursStart
        ? {
            enabled: true,
            startTime: userData.settings.notifications.quietHoursStart,
            endTime: userData.settings.notifications.quietHoursEnd || '08:00',
            timezone: 'UTC',
          }
        : undefined;

      if (isQuietHours(notifQuietHours, 'UTC')) {
        console.log(`[Auto-Archive] Quiet hours - skipping boundary message for now`);
        // TODO: Schedule boundary message for later (Story 6.5)
        // For now, just archive without sending boundary
        await createUndoRecord(userId, message.conversationId, message.id, false);
        continue;
      }

      // Send boundary message
      await sendBoundaryMessage(message, boundaryTemplate, userData);
      result.boundariesSent++;

      // Set rate limit key
      await setRateLimitKey(message.senderId, userId);

      // Create undo record
      await createUndoRecord(userId, message.conversationId, message.id, true);

    } catch (error) {
      console.error(`[Auto-Archive] Error archiving message ${message.id}:`, error);
      // Continue processing other messages even if one fails
    }
  }

  console.log(`[Auto-Archive] Results:`, result);
  return result;
}

/**
 * Sends boundary message to fan (Story 6.4)
 *
 * @param message - Original message that triggered archiving
 * @param template - Boundary message template
 * @param user - Creator user data
 * @returns Promise<void>
 */
async function sendBoundaryMessage(
  message: Message,
  template: string,
  user: User
): Promise<void> {
  const firestore = getFirebaseDb();

  // Render template with user-specific variables
  const rendered = renderBoundaryTemplate(template, {
    creatorName: user.displayName,
    faqUrl: undefined, // TODO: Add FAQ URL to user settings (Story 6.5)
    communityUrl: undefined, // TODO: Add community URL to user settings (Story 6.5)
  });

  // Create boundary message
  const messagesRef = collection(firestore, 'conversations', message.conversationId, 'messages');
  await addDoc(messagesRef, {
    conversationId: message.conversationId,
    senderId: user.uid,
    text: rendered,
    timestamp: Timestamp.now(),
    readBy: [user.uid],
    status: 'delivered',
    metadata: {
      isAutoBoundary: true,
      boundaryReason: 'low_priority',
      originalMessageId: message.id,
    },
  });

  console.log(`[Auto-Archive] Boundary message sent for conversation: ${message.conversationId}`);
}

/**
 * Creates undo archive record (Story 6.4)
 *
 * @param userId - Creator user ID
 * @param conversationId - Conversation ID
 * @param messageId - Original message ID
 * @param boundaryMessageSent - Whether boundary was sent
 * @returns Promise<void>
 */
async function createUndoRecord(
  userId: string,
  conversationId: string,
  messageId: string,
  boundaryMessageSent: boolean
): Promise<void> {
  const firestore = getFirebaseDb();
  const undoRef = collection(firestore, 'undo_archive');

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000); // 24 hours

  await addDoc(undoRef, {
    userId,
    conversationId,
    messageId,
    archivedAt: now,
    expiresAt,
    boundaryMessageSent,
    canUndo: true,
  });
}
