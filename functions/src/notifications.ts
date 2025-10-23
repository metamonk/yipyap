/**
 * Cloud Functions for Push Notifications
 * @module functions/notifications
 *
 * @remarks
 * Handles server-side push notification sending when new messages are created.
 * Includes rate limiting, badge counting, and preference enforcement.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';
import type { EventContext } from 'firebase-functions/v1';

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
 * Rate limiting configuration
 * Prevents notification spam by limiting sends per user per time period
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_NOTIFICATIONS_PER_WINDOW = 20; // Max 20 notifications per minute per user

/**
 * Push token types
 */
type PushTokenType = 'expo' | 'fcm' | 'apns';

/**
 * Detects the type of push token
 * @param token - The push token to analyze
 * @returns The detected token type
 * @remarks Reserved for future multi-platform token support
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
 * Interface for rate limit document in Firestore
 */
interface RateLimitData {
  count: number;
  windowStart: number;
}

/**
 * Checks if user has exceeded rate limit using Firestore for persistence
 * @param userId - User ID to check
 * @returns Promise resolving to true if rate limit exceeded
 * @remarks
 * Uses Firestore to track rate limits, ensuring persistence across cold starts
 */
async function isRateLimited(userId: string): Promise<boolean> {
  const now = Date.now();
  const rateLimitRef = db.collection('rateLimits').doc(userId);

  try {
    // Use transaction to ensure atomic read-modify-write
    const isLimited = await db.runTransaction(async (transaction) => {
      const rateLimitDoc = await transaction.get(rateLimitRef);

      if (!rateLimitDoc.exists) {
        // First request in this window
        transaction.set(rateLimitRef, {
          count: 1,
          windowStart: now,
        } as RateLimitData);
        return false;
      }

      const data = rateLimitDoc.data() as RateLimitData;

      // Check if we're in a new window
      if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
        // Start new window
        transaction.update(rateLimitRef, {
          count: 1,
          windowStart: now,
        });
        return false;
      }

      // Check if limit exceeded
      if (data.count >= MAX_NOTIFICATIONS_PER_WINDOW) {
        return true;
      }

      // Increment count
      transaction.update(rateLimitRef, {
        count: data.count + 1,
      });

      return false;
    });

    return isLimited;
  } catch (error) {
    console.error('[isRateLimited] Error checking rate limit:', error);
    // On error, fail open (allow the notification) to prevent blocking legitimate notifications
    return false;
  }
}

/**
 * Sanitizes text content for notifications to prevent XSS and injection attacks
 * @param text - The text to sanitize
 * @param maxLength - Maximum length of sanitized text (default: 500)
 * @returns Sanitized text safe for notification display
 * @remarks
 * - Removes HTML tags
 * - Escapes special characters
 * - Truncates to max length
 * - Removes control characters
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
 * Interface for user document data
 */
interface UserData {
  uid: string;
  displayName: string;
  username: string;
  fcmTokens?: Array<{
    token: string;
    type?: PushTokenType;
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
      vibration: boolean;
      directMessages: boolean;
      groupMessages: boolean;
      systemMessages: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
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
  unreadCount: Record<string, number>;
  mutedBy?: Record<string, boolean>;
  deletedBy?: Record<string, boolean>;
}

/**
 * Interface for message document data
 */
interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: admin.firestore.Timestamp;
}

/**
 * Sends push notifications via Expo Push Notification service
 * @param expoTokens - Array of Expo push tokens
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Notification data payload
 * @param badgeCount - Badge count for iOS
 * @param sound - Sound setting
 * @returns Promise resolving to send results
 * @remarks Reserved for future Expo push notification support
 */

async function sendExpoNotifications(
  expoTokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  badgeCount: number,
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
      badge: badgeCount,
      sound: sound || 'default',
      priority: 'high',
      channelId: data.type === 'group' ? 'groups' : 'messages',
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
 * Cloud Function: Send push notification when a new message is created
 *
 * @remarks
 * Triggered on new message creation in conversations/{conversationId}/messages/{messageId}
 * - Fetches conversation and participant data
 * - Checks user notification preferences
 * - Sends push notifications to all recipients (excluding sender)
 * - Routes Expo tokens to Expo API, FCM/APNs tokens to Firebase
 * - Updates badge counts
 * - Enforces rate limiting
 */
export const sendMessageNotification = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot: QueryDocumentSnapshot, context: EventContext) => {
    const { conversationId, messageId } = context.params;
    const message = snapshot.data() as MessageData;

    try {
      // Get conversation data
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();

      if (!conversationDoc.exists) {
        console.error('[sendMessageNotification] Conversation not found:', conversationId);
        return;
      }

      const conversation = conversationDoc.data() as ConversationData;

      // Get sender data
      const senderDoc = await db.collection('users').doc(message.senderId).get();

      if (!senderDoc.exists) {
        console.error('[sendMessageNotification] Sender not found:', message.senderId);
        return;
      }

      const sender = senderDoc.data() as UserData;

      // Check rate limit for sender
      if (await isRateLimited(message.senderId)) {
        console.warn('[sendMessageNotification] Rate limit exceeded for user:', message.senderId);
        return;
      }

      // Get recipient IDs (all participants except sender)
      const recipientIds = conversation.participantIds.filter((id) => id !== message.senderId);

      if (recipientIds.length === 0) {
        console.warn('[sendMessageNotification] No recipients for message:', messageId);
        return;
      }

      // Fetch all recipient user documents
      const recipientDocs = await Promise.all(
        recipientIds.map((id) => db.collection('users').doc(id).get())
      );

      const recipients = recipientDocs
        .filter((doc) => doc.exists)
        .map((doc) => doc.data() as UserData);

      // Prepare notification data
      const notificationType = conversation.type === 'group' ? 'group' : 'message';
      const conversationName =
        conversation.type === 'group' ? conversation.groupName || 'Group Chat' : sender.displayName;

      // Send notification to each recipient
      const sendPromises = recipients.map(async (recipient) => {
        try {
          // Note: We don't check deletedBy here because the message service auto-restores
          // deleted conversations when new messages arrive (matches WhatsApp/Signal behavior).
          // By the time this notification runs, deletedBy will already be cleared for recipients.

          // Check if conversation is muted for this user
          if (conversation.mutedBy?.[recipient.uid] === true) {
            console.warn('[sendMessageNotification] Conversation muted for user:', recipient.uid);
            return null;
          }

          // Check if user has notifications enabled
          if (!shouldSendNotification(recipient, notificationType)) {
            console.warn(
              '[sendMessageNotification] Notifications disabled for user:',
              recipient.uid
            );
            return null;
          }

          // Get all tokens for this user
          const allTokens = recipient.fcmTokens || [];

          if (allTokens.length === 0) {
            console.warn('[sendMessageNotification] No tokens for user:', recipient.uid);
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

          // Get badge count for this user
          const badgeCount = (conversation.unreadCount?.[recipient.uid] || 0) + 1;

          // Determine if we should show preview
          const showPreview = recipient.settings?.notifications?.showPreview !== false;

          // Sanitize notification content
          const sanitizedSenderName = sanitizeNotificationText(sender.displayName, 100);
          const sanitizedConversationName = sanitizeNotificationText(conversationName, 100);
          const sanitizedMessageText = sanitizeNotificationText(message.text, 200);

          const title = sanitizedConversationName;
          const body = showPreview
            ? `${sanitizedSenderName}: ${sanitizedMessageText}`
            : 'New message';

          const notificationData = {
            conversationId,
            senderId: message.senderId,
            messageId,
            type: notificationType,
            timestamp: message.timestamp.toMillis().toString(),
          };

          const soundSetting =
            recipient.settings?.notifications?.sound !== false ? 'default' : undefined;

          // Send to Expo tokens
          let expoResults = {
            success: 0,
            failure: 0,
            errors: [] as Array<{ token: string; error: string }>,
          };
          if (expoTokens.length > 0) {
            expoResults = await sendExpoNotifications(
              expoTokens,
              title,
              body,
              notificationData,
              badgeCount,
              soundSetting
            );

            console.warn(
              `[sendMessageNotification] Sent Expo to ${recipient.uid}: ${expoResults.success}/${expoTokens.length} succeeded`
            );

            // Clean up invalid Expo tokens
            if (expoResults.errors.length > 0) {
              const invalidExpoTokens = expoResults.errors
                .filter(
                  (err) =>
                    err.error.includes('DeviceNotRegistered') ||
                    err.error.includes('InvalidCredentials')
                )
                .map((err) => err.token);

              if (invalidExpoTokens.length > 0) {
                await cleanupInvalidTokens(recipient.uid, invalidExpoTokens);
              }
            }
          }

          // Send to native FCM/APNs tokens
          let nativeResults: admin.messaging.BatchResponse = {
            successCount: 0,
            failureCount: 0,
            responses: [],
          };
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
                    badge: badgeCount,
                    sound: soundSetting,
                    contentAvailable: true,
                    mutableContent: true,
                  },
                },
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: notificationType === 'group' ? 'groups' : 'messages',
                  priority: 'high',
                  sound: soundSetting,
                  tag: conversationId,
                  notificationCount: badgeCount,
                },
              },
            };

            nativeResults = await messaging.sendEachForMulticast(payload);

            console.warn(
              `[sendMessageNotification] Sent FCM/APNs to ${recipient.uid}: ${nativeResults.successCount}/${nativeTokens.length} succeeded`
            );

            // Handle failed native tokens
            if (nativeResults.failureCount > 0) {
              const invalidTokens: string[] = [];

              nativeResults.responses.forEach((resp, idx: number) => {
                if (!resp.success && resp.error) {
                  const errorCode = resp.error.code;
                  if (
                    errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered'
                  ) {
                    invalidTokens.push(nativeTokens[idx]);
                  }
                }
              });

              if (invalidTokens.length > 0) {
                await cleanupInvalidTokens(recipient.uid, invalidTokens);
              }
            }
          }

          return {
            expo: expoResults,
            native: nativeResults,
          };
        } catch (error) {
          console.error('[sendMessageNotification] Error sending to user:', recipient.uid, error);
          return null;
        }
      });

      await Promise.all(sendPromises);
      console.warn('[sendMessageNotification] Completed for message:', messageId);
    } catch (error) {
      console.error('[sendMessageNotification] Error processing message:', error);
      throw error;
    }
  });

/**
 * Checks if notification should be sent to user based on preferences
 * @param user - User data
 * @param type - Notification type
 * @returns True if notification should be sent
 */
function shouldSendNotification(user: UserData, type: 'message' | 'group' | 'system'): boolean {
  const prefs = user.settings?.notifications;

  if (!prefs) {
    // Default to enabled if no preferences set
    return true;
  }

  if (!prefs.enabled) {
    return false;
  }

  // Check category-specific preferences
  if (type === 'message' && prefs.directMessages === false) {
    return false;
  }

  if (type === 'group' && prefs.groupMessages === false) {
    return false;
  }

  if (type === 'system' && prefs.systemMessages === false) {
    return false;
  }

  // Check quiet hours
  if (prefs.quietHoursStart && prefs.quietHoursEnd) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours
    const inQuietHours =
      startTime > endTime
        ? currentTime >= startTime || currentTime < endTime
        : currentTime >= startTime && currentTime < endTime;

    if (inQuietHours) {
      return false;
    }
  }

  return true;
}

/**
 * Removes invalid FCM tokens from user document
 * @param userId - User ID
 * @param invalidTokens - Array of invalid token strings
 */
async function cleanupInvalidTokens(userId: string, invalidTokens: string[]): Promise<void> {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return;
    }

    const userData = userDoc.data() as UserData;
    const currentTokens = userData.fcmTokens || [];

    // Filter out invalid tokens
    const validTokens = currentTokens.filter((t) => !invalidTokens.includes(t.token));

    await userRef.update({
      fcmTokens: validTokens,
    });

    console.warn(
      `[cleanupInvalidTokens] Removed ${invalidTokens.length} invalid token(s) for user:`,
      userId
    );
  } catch (error) {
    console.error('[cleanupInvalidTokens] Error cleaning up tokens:', error);
  }
}
