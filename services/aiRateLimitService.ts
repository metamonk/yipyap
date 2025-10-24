/**
 * AI Rate Limiting Service
 * @module services/aiRateLimitService
 *
 * @remarks
 * Story 5.9 - Task 10: Rate Limiting Service
 * Implements sliding window rate limiting for AI operations to:
 * - Prevent abuse and runaway costs
 * - Ensure fair usage across users
 * - Provide graceful degradation when limits exceeded
 *
 * Uses Firestore for distributed rate limiting across devices/sessions.
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './firebase';
import * as Notifications from 'expo-notifications';

/**
 * Rate limit configuration per operation type
 * @remarks
 * Limits defined based on expected usage patterns and cost considerations
 */
const RATE_LIMITS = {
  categorization: {
    perHour: 200,
    perDay: 2000,
  },
  sentiment: {
    perHour: 200,
    perDay: 2000,
  },
  faq_detection: {
    perHour: 200,
    perDay: 2000,
  },
  voice_matching: {
    perHour: 50,
    perDay: 500,
  },
  opportunity_scoring: {
    perHour: 100,
    perDay: 1000,
  },
  daily_agent: {
    perHour: 2,
    perDay: 2,
  },
} as const;

/**
 * Operation type for rate limiting
 */
export type RateLimitOperation = keyof typeof RATE_LIMITS;

/**
 * Rate limit status for an operation
 */
export interface RateLimitStatus {
  /** Operation being checked */
  operation: RateLimitOperation;

  /** Current request count in the hour window */
  hourlyCount: number;

  /** Hourly limit */
  hourlyLimit: number;

  /** Current request count in the day window */
  dailyCount: number;

  /** Daily limit */
  dailyLimit: number;

  /** Whether hourly limit has been reached */
  hourlyLimitReached: boolean;

  /** Whether daily limit has been reached */
  dailyLimitReached: boolean;

  /** When the hourly window resets */
  hourlyResetAt: Date;

  /** When the daily window resets */
  dailyResetAt: Date;

  /** User-friendly message if limit reached */
  message?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  /** Whether the operation is allowed */
  allowed: boolean;

  /** Rate limit status details */
  status: RateLimitStatus;

  /** Reason for rejection (if not allowed) */
  reason?: 'hourly_limit' | 'daily_limit';
}

/**
 * Gets the Firestore instance using lazy initialization
 * @returns Firestore instance
 */
const getDb = () => {
  return getFirestore(getFirebaseApp());
};

/**
 * Generate rate limit document ID for hour window
 * @param userId - User ID
 * @param operation - Operation type
 * @param timestamp - Current timestamp
 * @returns Document ID
 */
function getHourlyDocId(userId: string, operation: RateLimitOperation, timestamp: Date): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hour = String(timestamp.getHours()).padStart(2, '0');

  return `${userId}_${operation}_${year}-${month}-${day}-${hour}`;
}

/**
 * Generate rate limit document ID for day window
 * @param userId - User ID
 * @param operation - Operation type
 * @param timestamp - Current timestamp
 * @returns Document ID
 */
function getDailyDocId(userId: string, operation: RateLimitOperation, timestamp: Date): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');

  return `${userId}_${operation}_${year}-${month}-${day}`;
}

/**
 * Get current count for a time window
 * @param docId - Document ID
 * @returns Current count or 0 if document doesn't exist
 */
async function getWindowCount(docId: string): Promise<number> {
  try {
    const db = getDb();
    const docRef = doc(db, 'rate_limits', docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return 0;
    }

    const data = docSnap.data();
    return data.count || 0;
  } catch (error) {
    console.error('[aiRateLimitService] Error getting window count:', error);
    // On error, return 0 to avoid blocking users
    return 0;
  }
}

/**
 * Increment count for a time window
 * @param docId - Document ID
 * @param expiresAt - When this window expires
 * @returns The new count after increment, or 0 on error
 */
async function incrementWindowCount(docId: string, expiresAt: Date): Promise<number> {
  try {
    const db = getDb();
    const docRef = doc(db, 'rate_limits', docId);
    const docSnap = await getDoc(docRef);

    let newCount: number;

    if (!docSnap.exists()) {
      // Create new document
      newCount = 1;
      await setDoc(docRef, {
        count: newCount,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
        warningNotificationSent: false,
      });
    } else {
      // Increment existing document
      const currentCount = docSnap.data().count || 0;
      newCount = currentCount + 1;
      await setDoc(
        docRef,
        {
          count: newCount,
          expiresAt: Timestamp.fromDate(expiresAt),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }

    return newCount;
  } catch (error) {
    console.error('[aiRateLimitService] Error incrementing window count:', error);
    // Non-blocking - don't throw
    return 0;
  }
}

/**
 * Check if user is within rate limits for an operation
 *
 * @param userId - User ID to check limits for
 * @param operation - Type of AI operation
 * @returns Promise<RateLimitCheckResult> - Rate limit check result
 *
 * @remarks
 * Uses sliding window algorithm with separate hour and day windows.
 * Checks both hourly and daily limits. Returns detailed status information.
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit('user123', 'categorization');
 * if (!result.allowed) {
 *   throw new Error(result.status.message);
 * }
 * // Proceed with operation
 * ```
 */
export async function checkRateLimit(
  userId: string,
  operation: RateLimitOperation
): Promise<RateLimitCheckResult> {
  try {
    // Get current authenticated user
    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;

    // Only check rate limits if authenticated user matches the target userId
    // This prevents permission errors when operations run on behalf of another user
    if (!currentUser || currentUser.uid !== userId) {
      // Return allowed=true to not block operations running cross-user
      // (e.g., sender checking recipient's rate limits won't work due to permissions)
      return {
        allowed: true,
        status: {
          operation,
          hourly: {
            used: 0,
            limit: RATE_LIMITS[operation].perHour,
            remaining: RATE_LIMITS[operation].perHour,
          },
          daily: {
            used: 0,
            limit: RATE_LIMITS[operation].perDay,
            remaining: RATE_LIMITS[operation].perDay,
          },
          message: 'Rate limit check skipped (auth mismatch)',
        },
        reason: undefined,
      };
    }
    const now = new Date();
    const limits = RATE_LIMITS[operation];

    // Get hourly and daily document IDs
    const hourlyDocId = getHourlyDocId(userId, operation, now);
    const dailyDocId = getDailyDocId(userId, operation, now);

    // Get current counts
    const [hourlyCount, dailyCount] = await Promise.all([
      getWindowCount(hourlyDocId),
      getWindowCount(dailyDocId),
    ]);

    // Calculate reset times
    const hourlyResetAt = new Date(now);
    hourlyResetAt.setHours(hourlyResetAt.getHours() + 1, 0, 0, 0);

    const dailyResetAt = new Date(now);
    dailyResetAt.setDate(dailyResetAt.getDate() + 1);
    dailyResetAt.setHours(0, 0, 0, 0);

    // Check limits
    const hourlyLimitReached = hourlyCount >= limits.perHour;
    const dailyLimitReached = dailyCount >= limits.perDay;

    const status: RateLimitStatus = {
      operation,
      hourlyCount,
      hourlyLimit: limits.perHour,
      dailyCount,
      dailyLimit: limits.perDay,
      hourlyLimitReached,
      dailyLimitReached,
      hourlyResetAt,
      dailyResetAt,
    };

    // Determine if allowed
    let allowed = true;
    let reason: 'hourly_limit' | 'daily_limit' | undefined;

    if (hourlyLimitReached) {
      allowed = false;
      reason = 'hourly_limit';
      const minutesUntilReset = Math.ceil((hourlyResetAt.getTime() - now.getTime()) / (60 * 1000));
      status.message = `You've reached your hourly limit for this operation (${limits.perHour} requests/hour). Please try again in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}.`;
    } else if (dailyLimitReached) {
      allowed = false;
      reason = 'daily_limit';
      const hoursUntilReset = Math.ceil(
        (dailyResetAt.getTime() - now.getTime()) / (60 * 60 * 1000)
      );
      status.message = `You've reached your daily limit for this operation (${limits.perDay} requests/day). Please try again in ${hoursUntilReset} hour${hoursUntilReset !== 1 ? 's' : ''}.`;
    }

    return {
      allowed,
      status,
      reason,
    };
  } catch (error) {
    console.error('[aiRateLimitService] Error checking rate limit:', error);
    // On error, allow the operation to avoid blocking users
    const limits = RATE_LIMITS[operation];
    return {
      allowed: true,
      status: {
        operation,
        hourlyCount: 0,
        hourlyLimit: limits.perHour,
        dailyCount: 0,
        dailyLimit: limits.perDay,
        hourlyLimitReached: false,
        dailyLimitReached: false,
        hourlyResetAt: new Date(),
        dailyResetAt: new Date(),
        message: 'Rate limit check failed - assuming allowed',
      },
    };
  }
}

/**
 * Increment operation count after successful AI operation
 *
 * @param userId - User ID
 * @param operation - Type of AI operation
 *
 * @remarks
 * Should be called AFTER successful AI operation completion.
 * Updates both hourly and daily counters.
 * Non-blocking - failures are logged but don't throw.
 *
 * @example
 * ```typescript
 * // After successful AI operation
 * await incrementOperationCount('user123', 'categorization');
 * ```
 */
export async function incrementOperationCount(
  userId: string,
  operation: RateLimitOperation
): Promise<void> {
  try {
    // Get current authenticated user
    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;

    // Only increment if authenticated user matches the target userId
    // This prevents permission errors when operations run on behalf of another user
    if (!currentUser || currentUser.uid !== userId) {
      return;
    }
    const now = new Date();
    const limits = RATE_LIMITS[operation];

    // Get hourly and daily document IDs
    const hourlyDocId = getHourlyDocId(userId, operation, now);
    const dailyDocId = getDailyDocId(userId, operation, now);

    // Calculate expiration times
    const hourlyExpiresAt = new Date(now);
    hourlyExpiresAt.setHours(hourlyExpiresAt.getHours() + 1, 0, 0, 0);

    const dailyExpiresAt = new Date(now);
    dailyExpiresAt.setDate(dailyExpiresAt.getDate() + 1);
    dailyExpiresAt.setHours(0, 0, 0, 0);

    // Increment both counters in parallel and get new counts
    const [hourlyCount, dailyCount] = await Promise.all([
      incrementWindowCount(hourlyDocId, hourlyExpiresAt),
      incrementWindowCount(dailyDocId, dailyExpiresAt),
    ]);

    // Check if we should send warning notifications (at 80% threshold)
    const hourlyPercent = Math.round((hourlyCount / limits.perHour) * 100);
    const dailyPercent = Math.round((dailyCount / limits.perDay) * 100);

    // Send hourly warning if at 80% or above
    if (hourlyPercent >= 80 && hourlyPercent < 100) {
      const db = getDb();
      const hourlyDocRef = doc(db, 'rate_limits', hourlyDocId);
      const hourlyDoc = await getDoc(hourlyDocRef);

      // Only send if we haven't sent notification for this window yet
      if (hourlyDoc.exists() && !hourlyDoc.data().warningNotificationSent) {
        await sendRateLimitWarning(operation, hourlyPercent, 'hourly', hourlyExpiresAt);

        // Mark that we've sent notification for this window
        await setDoc(
          hourlyDocRef,
          {
            warningNotificationSent: true,
          },
          { merge: true }
        );
      }
    }

    // Send daily warning if at 80% or above
    if (dailyPercent >= 80 && dailyPercent < 100) {
      const db = getDb();
      const dailyDocRef = doc(db, 'rate_limits', dailyDocId);
      const dailyDoc = await getDoc(dailyDocRef);

      // Only send if we haven't sent notification for this window yet
      if (dailyDoc.exists() && !dailyDoc.data().warningNotificationSent) {
        await sendRateLimitWarning(operation, dailyPercent, 'daily', dailyExpiresAt);

        // Mark that we've sent notification for this window
        await setDoc(
          dailyDocRef,
          {
            warningNotificationSent: true,
          },
          { merge: true }
        );
      }
    }
  } catch (error) {
    console.error('[aiRateLimitService] Error incrementing operation count:', error);
    // Non-blocking - don't throw
  }
}

/**
 * Get rate limit status for a user's operation without checking/incrementing
 *
 * @param userId - User ID
 * @param operation - Type of AI operation
 * @returns Promise<RateLimitStatus> - Current rate limit status
 *
 * @remarks
 * Use this for displaying rate limit status in UI without affecting counters.
 * Useful for dashboards and user information screens.
 *
 * @example
 * ```typescript
 * const status = await getRateLimitStatus('user123', 'categorization');
 * console.log(`Used ${status.hourlyCount}/${status.hourlyLimit} requests this hour`);
 * ```
 */
export async function getRateLimitStatus(
  userId: string,
  operation: RateLimitOperation
): Promise<RateLimitStatus> {
  const result = await checkRateLimit(userId, operation);
  return result.status;
}

/**
 * Clean up expired rate limit documents
 *
 * @remarks
 * Should be called periodically (e.g., daily) to remove old rate limit documents.
 * This is a maintenance function to prevent Firestore bloat.
 * Not critical for operation - rate limits work fine without cleanup.
 *
 * Note: Could be implemented as a Cloud Function scheduled task.
 */
export async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    const db = getDb();
    const now = Timestamp.now();

    // Query for expired documents
    const rateLimitsRef = collection(db, 'rate_limits');
    const q = query(rateLimitsRef, where('expiresAt', '<', now));
    const snapshot = await getDocs(q);

    // Delete expired documents
    const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.warn(
      `[aiRateLimitService] Cleaned up ${snapshot.docs.length} expired rate limit documents`
    );
  } catch (error) {
    console.error('[aiRateLimitService] Error cleaning up expired rate limits:', error);
    // Non-critical - don't throw
  }
}

/**
 * Send rate limit warning notification to user
 *
 * @param operation - Operation type that's approaching limit
 * @param percentUsed - Percentage of limit used (e.g., 80, 90, 100)
 * @param limitType - Whether it's hourly or daily limit
 * @param resetTime - When the limit resets
 *
 * @remarks
 * Sends a local notification to warn user they're approaching rate limits.
 * Non-blocking - failures are logged but don't affect rate limiting.
 */
async function sendRateLimitWarning(
  operation: RateLimitOperation,
  percentUsed: number,
  limitType: 'hourly' | 'daily',
  resetTime: Date
): Promise<void> {
  try {
    const operationLabel = operation.replace(/_/g, ' ');
    const timeUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / (60 * 1000));
    const timeLabel =
      timeUntilReset > 60
        ? `${Math.ceil(timeUntilReset / 60)} hour${Math.ceil(timeUntilReset / 60) !== 1 ? 's' : ''}`
        : `${timeUntilReset} minute${timeUntilReset !== 1 ? 's' : ''}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ AI Usage Warning',
        body: `You've used ${percentUsed}% of your ${limitType} ${operationLabel} limit. Limit resets in ${timeLabel}.`,
        data: {
          type: 'rate_limit_warning',
          operation,
          percentUsed,
          limitType,
          resetTime: resetTime.toISOString(),
        },
        sound: 'default',
      },
      trigger: null, // Show immediately
    });

    console.warn(
      `[aiRateLimitService] Sent rate limit warning for ${operation} (${percentUsed}% of ${limitType} limit)`
    );
  } catch (error) {
    console.error('[aiRateLimitService] Error sending rate limit warning:', error);
    // Non-blocking - don't throw
  }
}
