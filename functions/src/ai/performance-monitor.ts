/**
 * Cloud Function for AI Performance Monitoring
 * @module functions/ai/performance-monitor
 *
 * @remarks
 * Story 5.9 - AI Performance Monitoring & Cost Control
 * Scheduled function that runs every 15 minutes to monitor performance degradation.
 * - Checks latency thresholds (>500ms)
 * - Checks error rates (>5%)
 * - Sends performance alerts via push notifications
 * - Implements cooldown period to prevent spam (1 hour)
 * - Logs performance events for analytics
 */

import * as functions from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Latency threshold in milliseconds that triggers performance alerts
 */
const LATENCY_THRESHOLD_MS = 500;

/**
 * Error rate threshold (0.05 = 5%) that triggers performance alerts
 */
const ERROR_RATE_THRESHOLD = 0.05;

/**
 * Minimum operations required to calculate meaningful statistics
 */
const MIN_OPERATIONS_FOR_ALERT = 10;

/**
 * Cooldown period in milliseconds (1 hour) to prevent alert spam
 */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Expo Push Notification API URL
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Interface for performance metrics document
 */
interface AIPerformanceMetrics {
  id: string;
  userId: string;
  operation: 'categorization' | 'sentiment' | 'faq_detection' | 'voice_matching' | 'opportunity_scoring' | 'daily_agent';
  latency: number;
  timestamp: admin.firestore.Timestamp;
  success: boolean;
  errorType?: string;
  modelUsed: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  costCents: number;
  cacheHit: boolean;
  cacheKey?: string;
  createdAt: admin.firestore.Timestamp;
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
 * Interface for performance alert record (stored in Firestore for cooldown tracking)
 */
interface PerformanceAlert {
  userId: string;
  alertType: 'high_latency' | 'high_error_rate';
  operation: string;
  sentAt: admin.firestore.Timestamp;
  metricValue: number; // Latency in ms or error rate as decimal
  threshold: number;
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
 * Gets a human-readable label for an operation type
 * @param operation - Operation type identifier
 * @returns Human-readable operation label
 */
function getOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    categorization: 'Message Categorization',
    sentiment: 'Sentiment Analysis',
    faq_detection: 'FAQ Detection',
    voice_matching: 'Voice Matching',
    opportunity_scoring: 'Opportunity Scoring',
    daily_agent: 'Daily Agent Workflow',
  };
  return labels[operation] || operation;
}

/**
 * Checks if an alert was recently sent for this user and operation
 *
 * @param userId - User ID
 * @param alertType - Type of alert
 * @param operation - Operation type
 * @returns True if alert was sent within cooldown period
 *
 * @remarks
 * Implements 1-hour cooldown to prevent alert spam.
 */
async function isAlertInCooldown(
  userId: string,
  alertType: 'high_latency' | 'high_error_rate',
  operation: string
): Promise<boolean> {
  try {
    const cutoffTime = admin.firestore.Timestamp.fromMillis(Date.now() - ALERT_COOLDOWN_MS);

    const recentAlerts = await db
      .collection('users')
      .doc(userId)
      .collection('performance_alerts')
      .where('alertType', '==', alertType)
      .where('operation', '==', operation)
      .where('sentAt', '>=', cutoffTime)
      .limit(1)
      .get();

    return !recentAlerts.empty;
  } catch (error) {
    console.error('[isAlertInCooldown] Error checking cooldown:', error);
    return false; // On error, allow alert to be sent
  }
}

/**
 * Sends performance degradation alert to user
 *
 * @param userId - User ID to send alert to
 * @param alertType - Type of performance issue
 * @param operation - Operation experiencing performance issues
 * @param metricValue - Actual metric value (latency in ms or error rate as decimal)
 * @param threshold - Threshold that was exceeded
 *
 * @remarks
 * Sends push notification via Expo or FCM depending on user's device tokens.
 * Logs alert to Firestore for cooldown tracking and analytics.
 */
async function sendPerformanceAlert(
  userId: string,
  alertType: 'high_latency' | 'high_error_rate',
  operation: string,
  metricValue: number,
  threshold: number
): Promise<void> {
  try {
    // Check cooldown
    if (await isAlertInCooldown(userId, alertType, operation)) {
      console.log(`[sendPerformanceAlert] Alert in cooldown for user ${userId}, operation ${operation}`);
      return;
    }

    // Get user document with FCM tokens
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.error(`[sendPerformanceAlert] User not found: ${userId}`);
      return;
    }

    const userData = userDoc.data() as UserData;

    // Check if user has notifications enabled
    if (userData.settings?.notifications?.enabled === false) {
      console.log(`[sendPerformanceAlert] Notifications disabled for user: ${userId}`);
      return;
    }

    // Get user's push tokens
    const tokens = userData.fcmTokens || [];
    if (tokens.length === 0) {
      console.log(`[sendPerformanceAlert] No push tokens for user: ${userId}`);
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
    const operationLabel = getOperationLabel(operation);
    let title: string;
    let body: string;

    if (alertType === 'high_latency') {
      title = 'AI Performance Alert';
      body = `${operationLabel} is experiencing high latency (${Math.round(metricValue)}ms). This may affect response times.`;
    } else {
      const errorRate = (metricValue * 100).toFixed(1);
      title = 'AI Reliability Alert';
      body = `${operationLabel} has a ${errorRate}% error rate. Some operations may be failing.`;
    }

    const notificationData = {
      type: 'performance_alert',
      alertType,
      operation,
      metricValue: String(metricValue),
      threshold: String(threshold),
    };

    // Send to Expo tokens
    if (expoTokens.length > 0) {
      const expoResult = await sendExpoNotifications(expoTokens, title, body, notificationData);
      console.log(`[sendPerformanceAlert] Expo notifications sent: ${expoResult.success} success, ${expoResult.failure} failure`);
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
      console.log(`[sendPerformanceAlert] FCM notifications sent: ${fcmResult.successCount} success, ${fcmResult.failureCount} failure`);
    }

    // Log performance alert event for cooldown tracking and analytics
    await db.collection('users').doc(userId).collection('performance_alerts').add({
      alertType,
      operation,
      metricValue,
      threshold,
      sentAt: admin.firestore.Timestamp.now(),
    } as PerformanceAlert);

    console.log(`[sendPerformanceAlert] Performance alert sent to user ${userId}: ${alertType} for ${operation}`);
  } catch (error) {
    console.error('[sendPerformanceAlert] Error sending performance alert:', error);
    // Don't throw - this is a monitoring feature that shouldn't break AI operations
  }
}

/**
 * Checks latency thresholds for a user's recent operations
 *
 * @param userId - User ID to check
 * @param operation - Operation type to check
 * @param metrics - Recent performance metrics
 * @returns True if alert was sent
 *
 * @remarks
 * Calculates average latency over recent operations.
 * Sends alert if average latency exceeds LATENCY_THRESHOLD_MS (500ms).
 */
async function checkLatencyThresholds(
  userId: string,
  operation: string,
  metrics: AIPerformanceMetrics[]
): Promise<boolean> {
  if (metrics.length < MIN_OPERATIONS_FOR_ALERT) {
    return false;
  }

  // Calculate average latency
  const totalLatency = metrics.reduce((sum, m) => sum + m.latency, 0);
  const avgLatency = totalLatency / metrics.length;

  if (avgLatency > LATENCY_THRESHOLD_MS) {
    console.log(`[checkLatencyThresholds] User ${userId} operation ${operation}: avg latency ${Math.round(avgLatency)}ms exceeds threshold ${LATENCY_THRESHOLD_MS}ms`);

    await sendPerformanceAlert(userId, 'high_latency', operation, avgLatency, LATENCY_THRESHOLD_MS);
    return true;
  }

  return false;
}

/**
 * Checks error rates for a user's recent operations
 *
 * @param userId - User ID to check
 * @param operation - Operation type to check
 * @param metrics - Recent performance metrics
 * @returns True if alert was sent
 *
 * @remarks
 * Calculates error rate over recent operations.
 * Sends alert if error rate exceeds ERROR_RATE_THRESHOLD (5%).
 */
async function checkErrorRates(
  userId: string,
  operation: string,
  metrics: AIPerformanceMetrics[]
): Promise<boolean> {
  if (metrics.length < MIN_OPERATIONS_FOR_ALERT) {
    return false;
  }

  // Calculate error rate
  const successCount = metrics.filter((m) => m.success).length;
  const errorRate = 1 - (successCount / metrics.length);

  if (errorRate > ERROR_RATE_THRESHOLD) {
    console.log(`[checkErrorRates] User ${userId} operation ${operation}: error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(ERROR_RATE_THRESHOLD * 100).toFixed(1)}%`);

    await sendPerformanceAlert(userId, 'high_error_rate', operation, errorRate, ERROR_RATE_THRESHOLD);
    return true;
  }

  return false;
}

/**
 * Checks performance metrics for a single user
 *
 * @param userId - User ID to check
 * @returns Number of alerts sent for this user
 *
 * @remarks
 * Queries last 15 minutes of performance metrics for all operation types.
 * Checks latency and error rate thresholds for each operation.
 */
async function checkUserPerformance(userId: string): Promise<number> {
  let alertsSent = 0;

  try {
    // Get metrics from last 15 minutes
    const cutoffTime = admin.firestore.Timestamp.fromMillis(Date.now() - 15 * 60 * 1000);

    const metricsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('ai_performance_metrics')
      .where('timestamp', '>=', cutoffTime)
      .get();

    if (metricsSnapshot.empty) {
      return 0;
    }

    // Group metrics by operation
    const metricsByOperation: Record<string, AIPerformanceMetrics[]> = {};

    metricsSnapshot.forEach((doc) => {
      const metric = { id: doc.id, ...doc.data() } as AIPerformanceMetrics;
      if (!metricsByOperation[metric.operation]) {
        metricsByOperation[metric.operation] = [];
      }
      metricsByOperation[metric.operation].push(metric);
    });

    // Check each operation
    for (const [operation, metrics] of Object.entries(metricsByOperation)) {
      // Check latency
      if (await checkLatencyThresholds(userId, operation, metrics)) {
        alertsSent++;
      }

      // Check error rate
      if (await checkErrorRates(userId, operation, metrics)) {
        alertsSent++;
      }
    }

    return alertsSent;
  } catch (error) {
    console.error(`[checkUserPerformance] Error checking performance for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Scheduled Cloud Function: Check performance metrics for all users
 *
 * @remarks
 * Story 5.9 - AI Performance Monitoring & Cost Control
 * Runs every 15 minutes via Cloud Scheduler.
 * - Queries recent performance metrics for all users
 * - Checks latency thresholds (>500ms)
 * - Checks error rates (>5%)
 * - Sends alerts with 1-hour cooldown
 * - Logs execution metrics
 */
export const checkPerformanceMetrics = functions.onSchedule({
  schedule: 'every 15 minutes',
  timeZone: 'UTC',
}, async (event) => {
  console.log('[checkPerformanceMetrics] Starting performance check');

  const startTime = Date.now();
  let usersChecked = 0;
  let alertsSent = 0;

  try {
    // Get all users who have AI performance metrics
    // Note: We need to iterate through all users to check their subcollections
    const usersSnapshot = await db.collection('users').get();

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      try {
        const userAlertsSent = await checkUserPerformance(userId);
        if (userAlertsSent > 0) {
          usersChecked++;
          alertsSent += userAlertsSent;
        }
      } catch (error) {
        console.error(`[checkPerformanceMetrics] Error processing user ${userId}:`, error);
        // Continue processing other users
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[checkPerformanceMetrics] Completed in ${duration}ms: ${usersChecked} users with issues, ${alertsSent} alerts sent`);

    // Log execution metrics
    await db.collection('system_logs').add({
      type: 'performance_monitor_execution',
      timestamp: admin.firestore.Timestamp.now(),
      durationMs: duration,
      usersChecked,
      alertsSent,
    });
  } catch (error) {
    console.error('[checkPerformanceMetrics] Fatal error:', error);
    throw error; // Let Cloud Scheduler retry
  }
});
