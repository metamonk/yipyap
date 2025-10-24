/**
 * Cloud Functions for Sentiment-Based Crisis Notifications
 * @module functions/ai/sentimentNotifications
 *
 * @remarks
 * Story 5.3 - Sentiment Analysis & Crisis Detection
 * Handles high-priority push notifications when negative sentiment or crisis is detected.
 * Triggered when message metadata is updated with sentiment analysis results.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import type { Change, EventContext } from 'firebase-functions/v1';
import type { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Expo Push Notification API URL
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Interface for message document data with sentiment metadata
 */
interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: admin.firestore.Timestamp;
  metadata?: {
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
    sentimentScore?: number;
    emotionalTone?: string[];
    category?: string;
    aiProcessed?: boolean;
  };
}

/**
 * Interface for user document data
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
      showPreview: boolean;
      sound: boolean;
    };
  };
}

/**
 * Interface for conversation document data
 */
interface ConversationData {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[];
  groupName?: string;
  mutedBy?: Record<string, boolean>;
}

/**
 * Push token types
 */
type PushTokenType = 'expo' | 'fcm' | 'apns';

/**
 * Detects the type of push token
 * @param token - The push token to analyze
 * @returns The detected token type
 */
function detectTokenType(token: string): PushTokenType {
  if (!token || typeof token !== 'string') {
    return 'fcm'; // Default fallback
  }

  // Expo push tokens have a specific format
  if (token.startsWith('ExponentPushToken[') && token.endsWith(']')) {
    return 'expo';
  }

  // APNs tokens are 64 hex characters
  if (token.length === 64 && /^[a-f0-9]+$/i.test(token)) {
    return 'apns';
  }

  // Default to FCM for other formats (Android native tokens)
  return 'fcm';
}

/**
 * Sanitizes text content for notifications
 * @param text - The text to sanitize
 * @param maxLength - Maximum length of sanitized text (default: 500)
 * @returns Sanitized text safe for notification display
 */
function sanitizeNotificationText(text: string, maxLength = 500): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Remove control characters (except newlines, tabs, carriage returns)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // Replace multiple whitespaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

/**
 * Sends push notifications via Expo Push Notification service
 * @param expoTokens - Array of Expo push tokens
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Notification data payload
 * @param priority - Notification priority ('high' or 'default')
 * @param sound - Sound setting
 * @returns Promise resolving to send results
 */
async function sendExpoNotifications(
  expoTokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  priority: 'high' | 'default' = 'high',
  sound?: string
): Promise<{ success: number; failure: number; errors: Array<{ token: string; error: string }> }> {
  if (expoTokens.length === 0) {
    return { success: 0, failure: 0, errors: [] };
  }

  try {
    // Build Expo notification payload
    const messages = expoTokens.map((token) => ({
      to: token,
      title,
      body,
      data,
      badge: 1,
      sound: sound || 'urgent_alert.wav',
      priority,
      channelId: 'crisis_alerts',
    }));

    // Send to Expo Push API
    // eslint-disable-next-line no-undef
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
    const receipts = (result.data || []) as Array<{
      status: string;
      message?: string;
      details?: { error?: string };
    }>;

    // Count successes and failures
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ token: string; error: string }> = [];

    receipts.forEach((receipt, index: number) => {
      if (receipt.status === 'ok') {
        successCount++;
      } else {
        failureCount++;
        errors.push({
          token: expoTokens[index],
          error: receipt.message || receipt.details?.error || 'Unknown error',
        });
      }
    });

    return { success: successCount, failure: failureCount, errors };
  } catch (error) {
    console.error('[sendExpoNotifications] Error sending Expo notifications:', error);
    return {
      success: 0,
      failure: expoTokens.length,
      errors: expoTokens.map((token) => ({
        token,
        error: error instanceof Error ? error.message : 'Unknown error',
      })),
    };
  }
}

/**
 * Cloud Function: Send crisis alert when negative sentiment detected
 *
 * @remarks
 * Story 5.3 - Sentiment Analysis & Crisis Detection
 * Triggered on message metadata update in conversations/{conversationId}/messages/{messageId}
 * - Detects when crisisDetected flag is added (sentimentScore < -0.7)
 * - Sends high-priority push notification to conversation creator/participants
 * - Logs crisis event for analytics
 * - Uses urgent sound and crisis alert channel
 */
export const onCrisisDetected = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onUpdate(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
    const { conversationId, messageId } = context.params;

    const beforeData = change.before.data() as MessageData;
    const afterData = change.after.data() as MessageData;

    try {
      // Check if sentiment metadata was just added with crisis flag
      const beforeSentiment = beforeData.metadata?.sentiment;
      const afterSentiment = afterData.metadata?.sentiment;
      const sentimentScore = afterData.metadata?.sentimentScore;

      // Only trigger if:
      // 1. Sentiment metadata was just added (before: undefined, after: defined)
      // 2. Sentiment score indicates crisis (< -0.7)
      if (beforeSentiment !== undefined || afterSentiment === undefined || sentimentScore === undefined) {
        // Not a new sentiment analysis, skip
        return;
      }

      const crisisDetected = sentimentScore < -0.7;

      if (!crisisDetected) {
        // Not a crisis, skip
        return;
      }

      console.warn(
        `[onCrisisDetected] Crisis detected in message ${messageId}: sentiment=${afterSentiment}, score=${sentimentScore}`
      );

      // Get conversation data
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();

      if (!conversationDoc.exists) {
        console.error('[onCrisisDetected] Conversation not found:', conversationId);
        return;
      }

      const conversation = conversationDoc.data() as ConversationData;

      // Get sender data for notification
      const senderDoc = await db.collection('users').doc(afterData.senderId).get();

      if (!senderDoc.exists) {
        console.error('[onCrisisDetected] Sender not found:', afterData.senderId);
        return;
      }

      const sender = senderDoc.data() as UserData;

      // Get recipients (all participants except sender)
      const recipientIds = conversation.participantIds.filter((id) => id !== afterData.senderId);

      if (recipientIds.length === 0) {
        console.warn('[onCrisisDetected] No recipients for crisis alert:', messageId);
        return;
      }

      // Fetch recipient documents
      const recipientDocs = await Promise.all(
        recipientIds.map((id) => db.collection('users').doc(id).get())
      );

      const recipients = recipientDocs
        .filter((doc) => doc.exists)
        .map((doc) => doc.data() as UserData);

      // Prepare notification content
      const sanitizedSenderName = sanitizeNotificationText(sender.displayName, 100);
      const sanitizedMessagePreview = sanitizeNotificationText(afterData.text, 100);

      const title = '⚠️ Urgent: Negative Sentiment Detected';
      const body = `${sanitizedSenderName}: ${sanitizedMessagePreview}`;

      const notificationData = {
        conversationId,
        messageId,
        senderId: afterData.senderId,
        sentimentScore: sentimentScore.toString(),
        notificationType: 'crisis_detection',
        timestamp: afterData.timestamp.toMillis().toString(),
      };

      // Send high-priority notifications to all recipients
      const sendPromises = recipients.map(async (recipient) => {
        try {
          // Check if conversation is muted for this user
          if (conversation.mutedBy?.[recipient.uid] === true) {
            console.warn('[onCrisisDetected] Conversation muted for user:', recipient.uid);
            // Still send crisis alerts even if muted - crisis overrides mute
            // (Uncomment next line to respect mute for crisis alerts)
            // return null;
          }

          // Get all tokens for this user
          const allTokens = recipient.fcmTokens || [];

          if (allTokens.length === 0) {
            console.warn('[onCrisisDetected] No tokens for user:', recipient.uid);
            return null;
          }

          // Separate tokens by type
          const expoTokens: string[] = [];
          const nativeTokens: string[] = [];

          allTokens.forEach((tokenObj) => {
            if (!tokenObj.token) return;

            const tokenType = tokenObj.type || detectTokenType(tokenObj.token);

            if (tokenType === 'expo') {
              expoTokens.push(tokenObj.token);
            } else {
              nativeTokens.push(tokenObj.token);
            }
          });

          // Send to Expo tokens with urgent sound
          if (expoTokens.length > 0) {
            const expoResults = await sendExpoNotifications(
              expoTokens,
              title,
              body,
              notificationData,
              'high',
              'urgent_alert.wav'
            );

            console.warn(
              `[onCrisisDetected] Sent Expo to ${recipient.uid}: ${expoResults.success}/${expoTokens.length} succeeded`
            );
          }

          // Send to native FCM/APNs tokens
          if (nativeTokens.length > 0) {
            const payload: admin.messaging.MulticastMessage = {
              tokens: nativeTokens,
              notification: {
                title,
                body,
              },
              data: notificationData,
              apns: {
                payload: {
                  aps: {
                    badge: 1,
                    sound: 'urgent_alert.wav',
                    contentAvailable: true,
                    mutableContent: true,
                  },
                },
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'crisis_alerts',
                  priority: 'max',
                  sound: 'urgent_alert',
                  tag: conversationId,
                  notificationCount: 1,
                },
              },
            };

            const nativeResults = await messaging.sendEachForMulticast(payload);

            console.warn(
              `[onCrisisDetected] Sent FCM/APNs to ${recipient.uid}: ${nativeResults.successCount}/${nativeTokens.length} succeeded`
            );
          }

          return { success: true };
        } catch (error) {
          console.error('[onCrisisDetected] Error sending to user:', recipient.uid, error);
          return null;
        }
      });

      await Promise.all(sendPromises);

      // Log crisis event for analytics
      console.warn(
        `[onCrisisDetected] Crisis alert sent for message ${messageId}: sentiment=${afterSentiment}, score=${sentimentScore}`
      );
    } catch (error) {
      console.error('[onCrisisDetected] Error processing crisis detection:', error);
      throw error;
    }
  });
