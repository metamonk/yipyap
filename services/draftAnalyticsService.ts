/**
 * Draft Analytics Service for Tracking Draft Editing Behavior (Story 6.2)
 *
 * @remarks
 * This service tracks how creators interact with AI-generated drafts:
 * - Edit rates (% of drafts edited before sending)
 * - Edit counts and time-to-edit metrics
 * - Override rates for "requires editing" enforcement
 *
 * **Features:**
 * - Tracks wasEdited, editCount, timeToEdit metadata
 * - Calculates aggregate edit rate metrics
 * - Monitors override behavior for high-priority messages
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import type { DraftMessageMetadata } from '../types/ai';

/**
 * Draft edit event data
 * @interface
 */
export interface DraftEditEvent {
  /** Message ID */
  messageId: string;

  /** Conversation ID */
  conversationId: string;

  /** Whether the draft was edited */
  wasEdited: boolean;

  /** Number of edits made */
  editCount: number;

  /** Time from draft generation to send (milliseconds) */
  timeToEdit: number;

  /** Whether editing was required */
  requiresEditing: boolean;

  /** Whether user overrode "requires editing" enforcement */
  overrideApplied: boolean;

  /** Draft confidence score (0-100) */
  confidence: number;

  /** Draft version number */
  draftVersion: number;
}

/**
 * Edit rate metrics aggregated over a time period
 * @interface
 */
export interface EditRateMetrics {
  /** Time period for these metrics */
  period: 'daily' | 'weekly' | 'monthly';

  /** Start of measurement period */
  periodStart: any; // firebase.firestore.Timestamp

  /** End of measurement period */
  periodEnd: any; // firebase.firestore.Timestamp

  /** Total drafts sent */
  totalDrafts: number;

  /** Number of drafts edited before sending */
  draftsEdited: number;

  /** Edit rate (0.0-1.0) */
  editRate: number;

  /** Average number of edits per draft */
  averageEditCount: number;

  /** Average time to edit (milliseconds) */
  averageTimeToEdit: number;

  /** Number of "requires editing" overrides */
  overridesApplied: number;

  /** Override rate (0.0-1.0) */
  overrideRate: number;
}

/**
 * Result from tracking operation
 * @interface
 */
export interface TrackingResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Draft Analytics Service Class
 *
 * @remarks
 * Tracks draft editing behavior for analytics and AI improvement.
 * Stores edit events in Firestore and calculates aggregate metrics.
 *
 * @example
 * ```typescript
 * import { draftAnalyticsService } from '@/services/draftAnalyticsService';
 *
 * // Track edit event
 * await draftAnalyticsService.trackEditEvent({
 *   messageId: 'msg456',
 *   conversationId: 'conv123',
 *   wasEdited: true,
 *   editCount: 3,
 *   timeToEdit: 45000,
 *   requiresEditing: false,
 *   overrideApplied: false,
 *   confidence: 85,
 *   draftVersion: 1
 * });
 * ```
 */
export class DraftAnalyticsService {
  /**
   * Tracks a draft edit event
   *
   * @param event - Draft edit event data
   * @returns Promise resolving to tracking result
   *
   * @example
   * ```typescript
   * const result = await draftAnalyticsService.trackEditEvent({
   *   messageId: 'msg456',
   *   conversationId: 'conv123',
   *   wasEdited: true,
   *   editCount: 3,
   *   timeToEdit: 45000,
   *   requiresEditing: true,
   *   overrideApplied: false,
   *   confidence: 75,
   *   draftVersion: 1
   * });
   * ```
   */
  async trackEditEvent(event: DraftEditEvent): Promise<TrackingResult> {
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;

      if (!user) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      const db = getFirebaseDb();

      // Store edit event in draft_edit_events collection
      const eventDoc = {
        userId: user.uid,
        messageId: event.messageId,
        conversationId: event.conversationId,
        wasEdited: event.wasEdited,
        editCount: event.editCount,
        timeToEdit: event.timeToEdit,
        requiresEditing: event.requiresEditing,
        overrideApplied: event.overrideApplied,
        confidence: event.confidence,
        draftVersion: event.draftVersion,
        timestamp: serverTimestamp(),
      };

      await setDoc(
        doc(collection(db, 'users', user.uid, 'draft_edit_events')),
        eventDoc
      );

      // Update aggregate metrics
      await this.updateAggregateMetrics(user.uid, event);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[DraftAnalyticsService] Error tracking edit event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track edit event',
      };
    }
  }

  /**
   * Calculates edit rate metrics for a time period
   *
   * @param userId - The user's ID
   * @param period - Time period ('daily', 'weekly', 'monthly')
   * @param periodStart - Start of period (optional, defaults to beginning of current period)
   * @returns Promise resolving to edit rate metrics
   *
   * @example
   * ```typescript
   * const metrics = await draftAnalyticsService.calculateEditRateMetrics(
   *   'user123',
   *   'daily'
   * );
   *
   * console.log('Edit rate:', metrics.editRate);
   * console.log('Override rate:', metrics.overrideRate);
   * ```
   */
  async calculateEditRateMetrics(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    periodStart?: Timestamp
  ): Promise<EditRateMetrics> {
    try {
      const db = getFirebaseDb();

      // Calculate period boundaries
      const now = Timestamp.now();
      const start = periodStart || this.getPeriodStart(period);
      const end = now;

      // Query edit events for period
      const eventsRef = collection(db, 'users', userId, 'draft_edit_events');
      const q = query(
        eventsRef,
        where('timestamp', '>=', start),
        where('timestamp', '<=', end)
      );

      const querySnapshot = await getDocs(q);

      // Calculate metrics
      let totalDrafts = 0;
      let draftsEdited = 0;
      let totalEditCount = 0;
      let totalTimeToEdit = 0;
      let overridesApplied = 0;

      querySnapshot.forEach((doc) => {
        const event = doc.data();
        totalDrafts++;

        if (event.wasEdited) {
          draftsEdited++;
          totalEditCount += event.editCount || 0;
          totalTimeToEdit += event.timeToEdit || 0;
        }

        if (event.overrideApplied) {
          overridesApplied++;
        }
      });

      // Calculate rates and averages
      const editRate = totalDrafts > 0 ? draftsEdited / totalDrafts : 0;
      const averageEditCount = draftsEdited > 0 ? totalEditCount / draftsEdited : 0;
      const averageTimeToEdit = draftsEdited > 0 ? totalTimeToEdit / draftsEdited : 0;
      const overrideRate = totalDrafts > 0 ? overridesApplied / totalDrafts : 0;

      return {
        period,
        periodStart: start,
        periodEnd: end,
        totalDrafts,
        draftsEdited,
        editRate,
        averageEditCount,
        averageTimeToEdit,
        overrideRate,
        overridesApplied,
      };
    } catch (error) {
      console.error('[DraftAnalyticsService] Error calculating edit rate metrics:', error);

      // Return empty metrics on error
      const now = Timestamp.now();
      return {
        period,
        periodStart: periodStart || now,
        periodEnd: now,
        totalDrafts: 0,
        draftsEdited: 0,
        editRate: 0,
        averageEditCount: 0,
        averageTimeToEdit: 0,
        overrideRate: 0,
        overridesApplied: 0,
      };
    }
  }

  /**
   * Gets aggregate edit metrics for a user
   *
   * @param userId - The user's ID
   * @returns Promise resolving to aggregate metrics
   *
   * @example
   * ```typescript
   * const metrics = await draftAnalyticsService.getAggregateMetrics('user123');
   * console.log('Total drafts:', metrics.totalDrafts);
   * ```
   */
  async getAggregateMetrics(userId: string): Promise<EditRateMetrics | null> {
    try {
      const db = getFirebaseDb();
      const metricsRef = doc(db, 'users', userId, 'draft_metrics', 'aggregate');
      const metricsDoc = await getDoc(metricsRef);

      if (!metricsDoc.exists()) {
        return null;
      }

      return metricsDoc.data() as EditRateMetrics;
    } catch (error) {
      console.error('[DraftAnalyticsService] Error getting aggregate metrics:', error);
      return null;
    }
  }

  /**
   * Creates draft message metadata from edit event
   *
   * @param event - Draft edit event
   * @returns Draft message metadata object
   *
   * @example
   * ```typescript
   * const metadata = draftAnalyticsService.createDraftMetadata({
   *   messageId: 'msg456',
   *   conversationId: 'conv123',
   *   wasEdited: true,
   *   editCount: 3,
   *   timeToEdit: 45000,
   *   requiresEditing: false,
   *   overrideApplied: false,
   *   confidence: 85,
   *   draftVersion: 1
   * });
   * ```
   */
  createDraftMetadata(event: DraftEditEvent): DraftMessageMetadata {
    return {
      isAIDraft: true,
      confidence: event.confidence,
      wasEdited: event.wasEdited,
      editCount: event.editCount,
      timeToEdit: event.timeToEdit,
      requiresEditing: event.requiresEditing,
      draftSavedAt: serverTimestamp(),
      draftVersion: event.draftVersion,
      overrideApplied: event.overrideApplied,
    };
  }

  /**
   * Updates aggregate metrics after tracking an edit event
   *
   * @param userId - The user's ID
   * @param event - Draft edit event
   * @private
   */
  private async updateAggregateMetrics(
    userId: string,
    event: DraftEditEvent
  ): Promise<void> {
    try {
      const db = getFirebaseDb();
      const metricsRef = doc(db, 'users', userId, 'draft_metrics', 'aggregate');

      // Get current metrics
      const metricsDoc = await getDoc(metricsRef);

      if (!metricsDoc.exists()) {
        // Initialize metrics
        await setDoc(metricsRef, {
          totalDrafts: 1,
          draftsEdited: event.wasEdited ? 1 : 0,
          editRate: event.wasEdited ? 1.0 : 0.0,
          averageEditCount: event.wasEdited ? event.editCount : 0,
          averageTimeToEdit: event.wasEdited ? event.timeToEdit : 0,
          overridesApplied: event.overrideApplied ? 1 : 0,
          overrideRate: event.overrideApplied ? 1.0 : 0.0,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update existing metrics
        const currentMetrics = metricsDoc.data();
        const newTotalDrafts = currentMetrics.totalDrafts + 1;
        const newDraftsEdited = currentMetrics.draftsEdited + (event.wasEdited ? 1 : 0);
        const newOverridesApplied =
          currentMetrics.overridesApplied + (event.overrideApplied ? 1 : 0);

        // Calculate running averages
        const newAverageEditCount =
          event.wasEdited && newDraftsEdited > 0
            ? (currentMetrics.averageEditCount * currentMetrics.draftsEdited + event.editCount) /
              newDraftsEdited
            : currentMetrics.averageEditCount;

        const newAverageTimeToEdit =
          event.wasEdited && newDraftsEdited > 0
            ? (currentMetrics.averageTimeToEdit * currentMetrics.draftsEdited +
                event.timeToEdit) /
              newDraftsEdited
            : currentMetrics.averageTimeToEdit;

        await setDoc(
          metricsRef,
          {
            totalDrafts: newTotalDrafts,
            draftsEdited: newDraftsEdited,
            editRate: newDraftsEdited / newTotalDrafts,
            averageEditCount: newAverageEditCount,
            averageTimeToEdit: newAverageTimeToEdit,
            overridesApplied: newOverridesApplied,
            overrideRate: newOverridesApplied / newTotalDrafts,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('[DraftAnalyticsService] Error updating aggregate metrics:', error);
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Gets the start timestamp for a time period
   *
   * @param period - Time period ('daily', 'weekly', 'monthly')
   * @returns Timestamp for period start
   * @private
   */
  private getPeriodStart(period: 'daily' | 'weekly' | 'monthly'): Timestamp {
    const now = new Date();

    switch (period) {
      case 'daily':
        now.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        now.setDate(now.getDate() - now.getDay());
        now.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        break;
    }

    return Timestamp.fromDate(now);
  }
}

/**
 * Singleton instance of DraftAnalyticsService
 * @constant
 */
export const draftAnalyticsService = new DraftAnalyticsService();
