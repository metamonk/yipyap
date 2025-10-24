/**
 * Cloud Function for AI Budget Monitoring
 * @module functions/ai/budget-monitor
 *
 * @remarks
 * Story 5.9 - AI Performance Monitoring & Cost Control
 * Scheduled function that runs hourly to check budget thresholds and send alerts.
 * - Checks daily budget usage for all users with AI cost metrics
 * - Sends notification at 80% threshold
 * - Disables AI features at 100% threshold
 * - Logs budget events for analytics
 */

import * as functions from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Default daily budget limit in USD cents ($5.00)
 * @remarks Used for reference but actual budget is stored in cost metrics documents
 */
// const DEFAULT_DAILY_BUDGET_CENTS = 500;

/**
 * Budget alert threshold (80% of budget)
 * @remarks Checked against budgetUsedPercent in cost metrics
 */
// const BUDGET_ALERT_THRESHOLD = 0.8;

/**
 * Expo Push Notification API URL
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Interface for cost metrics document
 */
interface CostMetrics {
  userId: string;
  period: 'daily' | 'monthly';
  periodStart: admin.firestore.Timestamp;
  periodEnd: admin.firestore.Timestamp;
  totalCostCents: number;
  costByOperation: Record<string, number>;
  costByModel: Record<string, number>;
  budgetLimitCents: number;
  budgetUsedPercent: number;
  budgetAlertSent: boolean;
  budgetExceeded: boolean;
  totalTokens: number;
  tokensByOperation: Record<string, number>;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Interface for user document with FCM tokens
 */
interface UserData {
  uid: string;
  displayName: string;
  username: string;
  fcmTokens?: Array<{
    token: string;
    type?: 'expo' | 'fcm' | 'apns';
    platform: 'ios' | 'android';
    deviceId: string;
    appVersion: string;
    createdAt: admin.firestore.Timestamp;
    lastUsed: admin.firestore.Timestamp;
  }>;
  settings?: {
    notifications?: {
      enabled: boolean;
    };
  };
}

/**
 * Detects the type of push token
 * @param token - The push token to analyze
 * @returns The detected token type
 */
function detectTokenType(token: string): 'expo' | 'fcm' | 'apns' {
  if (!token || typeof token !== 'string') {
    return 'fcm';
  }

  if (token.startsWith('ExponentPushToken[') && token.endsWith(']')) {
    return 'expo';
  }

  if (token.length === 64 && /^[a-f0-9]+$/i.test(token)) {
    return 'apns';
  }

  return 'fcm';
}

/**
 * Sends push notifications via Expo Push Notification service
 * @param expoTokens - Array of Expo push tokens
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Notification data payload
 * @returns Promise resolving to send results
 */
async function sendExpoNotifications(
  expoTokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ success: number; failure: number }> {
  if (expoTokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  try {
    const messages = expoTokens.map((token) => ({
      to: token,
      title,
      body,
      data,
      badge: 1,
      sound: 'default',
      priority: 'high',
      channelId: 'system',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`Expo API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const receipts = (result.data || []) as Array<{ status: string }>;

    const successCount = receipts.filter((r) => r.status === 'ok').length;
    const failureCount = receipts.length - successCount;

    return { success: successCount, failure: failureCount };
  } catch (error) {
    console.error('[sendExpoNotifications] Error:', error);
    return { success: 0, failure: expoTokens.length };
  }
}

/**
 * Sends budget alert notification to user
 *
 * @param userId - User ID to send alert to
 * @param alertType - Type of alert ('threshold' for 80%, 'exceeded' for 100%)
 * @param costInfo - Cost information
 *
 * @remarks
 * Sends push notification via Expo or FCM depending on user's device tokens.
 * Uses system notification channel for non-urgent alerts.
 */
async function sendBudgetAlert(
  userId: string,
  alertType: 'threshold' | 'exceeded',
  costInfo: {
    totalCostCents: number;
    budgetLimitCents: number;
    usedPercent: number;
  }
): Promise<void> {
  try {
    // Get user document with FCM tokens
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.error(`[sendBudgetAlert] User not found: ${userId}`);
      return;
    }

    const userData = userDoc.data() as UserData;

    // Check if user has notifications enabled
    if (userData.settings?.notifications?.enabled === false) {
      console.log(`[sendBudgetAlert] Notifications disabled for user: ${userId}`);
      return;
    }

    // Get user's push tokens
    const tokens = userData.fcmTokens || [];
    if (tokens.length === 0) {
      console.log(`[sendBudgetAlert] No push tokens for user: ${userId}`);
      return;
    }

    // Separate tokens by type
    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];

    tokens.forEach((tokenData) => {
      const type = tokenData.type || detectTokenType(tokenData.token);
      if (type === 'expo') {
        expoTokens.push(tokenData.token);
      } else {
        fcmTokens.push(tokenData.token);
      }
    });

    // Prepare notification content
    const costInDollars = (costInfo.totalCostCents / 100).toFixed(2);
    const budgetInDollars = (costInfo.budgetLimitCents / 100).toFixed(2);

    let title: string;
    let body: string;

    if (alertType === 'threshold') {
      title = 'AI Budget Alert';
      body = `You've used ${costInfo.usedPercent.toFixed(0)}% ($${costInDollars}) of your daily AI budget ($${budgetInDollars}).`;
    } else {
      title = 'AI Budget Exceeded';
      body = `You've reached your daily AI budget limit ($${budgetInDollars}). AI features are temporarily disabled until tomorrow.`;
    }

    const notificationData = {
      type: 'budget_alert',
      alertType,
      totalCostCents: String(costInfo.totalCostCents),
      budgetLimitCents: String(costInfo.budgetLimitCents),
      usedPercent: String(costInfo.usedPercent),
    };

    // Send to Expo tokens
    if (expoTokens.length > 0) {
      const expoResult = await sendExpoNotifications(expoTokens, title, body, notificationData);
      console.log(`[sendBudgetAlert] Expo notifications sent: ${expoResult.success} success, ${expoResult.failure} failure`);
    }

    // Send to FCM tokens
    if (fcmTokens.length > 0) {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title,
          body,
        },
        data: notificationData,
        android: {
          priority: 'high',
          notification: {
            channelId: 'system',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
            },
          },
        },
      };

      const fcmResult = await admin.messaging().sendEachForMulticast(message);
      console.log(`[sendBudgetAlert] FCM notifications sent: ${fcmResult.successCount} success, ${fcmResult.failureCount} failure`);
    }

    // Log budget alert event for analytics
    await db.collection('users').doc(userId).collection('budget_alerts').add({
      alertType,
      totalCostCents: costInfo.totalCostCents,
      budgetLimitCents: costInfo.budgetLimitCents,
      usedPercent: costInfo.usedPercent,
      sentAt: admin.firestore.Timestamp.now(),
    });

    console.log(`[sendBudgetAlert] Budget alert sent to user ${userId}: ${alertType}`);
  } catch (error) {
    console.error('[sendBudgetAlert] Error sending budget alert:', error);
    // Don't throw - this is a monitoring feature that shouldn't break AI operations
  }
}

/**
 * Disables AI features for a user by setting a flag in their user document
 *
 * @param userId - User ID to disable features for
 *
 * @remarks
 * Sets `aiFeatures.disabled` flag to true and `aiFeatures.disabledReason` to 'budget_exceeded'.
 * This flag should be checked by all AI services before processing operations.
 * Flag is automatically reset at the start of the next day (by budget reset logic).
 */
async function disableAIFeatures(userId: string): Promise<void> {
  try {
    await db.collection('users').doc(userId).update({
      'aiFeatures.disabled': true,
      'aiFeatures.disabledReason': 'budget_exceeded',
      'aiFeatures.disabledAt': admin.firestore.Timestamp.now(),
    });

    console.log(`[disableAIFeatures] AI features disabled for user: ${userId}`);
  } catch (error) {
    console.error('[disableAIFeatures] Error disabling AI features:', error);
  }
}

/**
 * Checks daily budget for a single user and sends alerts if needed
 *
 * @param userId - User ID to check budget for
 * @param costMetrics - Current cost metrics document
 *
 * @remarks
 * - If budget used >= 80% and alert not sent: Send threshold alert
 * - If budget used >= 100% and features not disabled: Disable AI features and send exceeded alert
 */
async function checkUserBudget(userId: string, costMetrics: CostMetrics): Promise<void> {
  try {
    const { totalCostCents, budgetLimitCents, budgetUsedPercent, budgetAlertSent, budgetExceeded } = costMetrics;

    // Calculate actual percentage (budgetUsedPercent is already 0-100)
    const usedPercent = budgetUsedPercent;

    // Check if 80% threshold crossed and alert not sent
    if (usedPercent >= 80 && !budgetAlertSent) {
      console.log(`[checkUserBudget] User ${userId} reached ${usedPercent.toFixed(1)}% of budget - sending alert`);

      await sendBudgetAlert(userId, 'threshold', {
        totalCostCents,
        budgetLimitCents,
        usedPercent,
      });

      // Mark alert as sent
      const now = new Date();
      const periodId = `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await db.collection('users').doc(userId).collection('ai_cost_metrics').doc(periodId).update({
        budgetAlertSent: true,
      });
    }

    // Check if 100% threshold crossed and features not disabled
    if (usedPercent >= 100 && !budgetExceeded) {
      console.log(`[checkUserBudget] User ${userId} exceeded budget - disabling AI features`);

      // Disable AI features
      await disableAIFeatures(userId);

      // Send exceeded alert
      await sendBudgetAlert(userId, 'exceeded', {
        totalCostCents,
        budgetLimitCents,
        usedPercent,
      });

      // Mark budget as exceeded
      const now = new Date();
      const periodId = `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await db.collection('users').doc(userId).collection('ai_cost_metrics').doc(periodId).update({
        budgetExceeded: true,
      });
    }
  } catch (error) {
    console.error(`[checkUserBudget] Error checking budget for user ${userId}:`, error);
  }
}

/**
 * Scheduled Cloud Function: Check daily budgets for all users
 *
 * @remarks
 * Story 5.9 - AI Performance Monitoring & Cost Control
 * Runs every hour via Cloud Scheduler.
 * - Queries all users with cost metrics for today
 * - Checks budget thresholds for each user
 * - Sends alerts and disables features as needed
 * - Logs execution metrics
 */
export const checkDailyBudgets = functions.onSchedule({
  schedule: 'every 1 hours',
  timeZone: 'UTC',
}, async (event) => {
  console.log('[checkDailyBudgets] Starting daily budget check');

  const startTime = Date.now();
  let usersChecked = 0;
  let alertsSent = 0;
  let featuresDisabled = 0;

  try {
    // Get today's date for period ID
    const now = new Date();
    const periodId = `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Query all users collection (we need to iterate through users to access their subcollections)
    const usersSnapshot = await db.collection('users').get();

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        // Get today's cost metrics for this user
        const costMetricsDoc = await db
          .collection('users')
          .doc(userId)
          .collection('ai_cost_metrics')
          .doc(periodId)
          .get();

        if (!costMetricsDoc.exists) {
          // User has no AI usage today - skip
          continue;
        }

        const costMetrics = costMetricsDoc.data() as CostMetrics;

        // Check budget thresholds
        await checkUserBudget(userId, costMetrics);

        usersChecked++;

        // Track if we sent alerts or disabled features
        if (costMetrics.budgetUsedPercent >= 80) {
          alertsSent++;
        }
        if (costMetrics.budgetUsedPercent >= 100) {
          featuresDisabled++;
        }
      } catch (error) {
        console.error(`[checkDailyBudgets] Error processing user ${userId}:`, error);
        // Continue processing other users
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[checkDailyBudgets] Completed in ${duration}ms: ${usersChecked} users checked, ${alertsSent} alerts sent, ${featuresDisabled} features disabled`);

    // Log execution metrics
    await db.collection('system_logs').add({
      type: 'budget_monitor_execution',
      timestamp: admin.firestore.Timestamp.now(),
      durationMs: duration,
      usersChecked,
      alertsSent,
      featuresDisabled,
      periodId,
    });
  } catch (error) {
    console.error('[checkDailyBudgets] Fatal error:', error);
    throw error; // Let Cloud Scheduler retry
  }
});
