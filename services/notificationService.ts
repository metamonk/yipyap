/**
 * Notification service for handling push notifications
 * @module services/notificationService
 * @remarks
 * Handles foreground and background notifications with FCM integration.
 * Supports deep linking, notification categories, and badge management.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import type { Message } from '@/types/models';
import type { NotificationPreferences } from '@/types/user';
import { fcmTokenService } from './fcmTokenService';
import { getOpportunityNotificationSettings } from './userService';

/**
 * Notification category types (Story 5.3: Added crisis_detection, Story 5.6: Added business_opportunity)
 */
export type NotificationCategory =
  | 'message'
  | 'group'
  | 'system'
  | 'crisis_detection'
  | 'business_opportunity'
  | 'daily_digest';

/**
 * Notification payload data structure
 */
export interface NotificationData {
  /** ID of the conversation */
  conversationId: string;
  /** ID of the message sender */
  senderId: string;
  /** ID of the message */
  messageId: string;
  /** Type of notification */
  type: NotificationCategory;
  /** Timestamp of the message */
  timestamp: string;
}

/**
 * Currently active conversation ID (null if not viewing any conversation)
 */
let activeConversationId: string | null = null;

/**
 * Sets the currently active conversation
 * @param conversationId - The conversation ID or null if not viewing any
 * @example
 * ```typescript
 * // When user navigates to a conversation
 * setActiveConversation('conv-123');
 *
 * // When user leaves the conversation
 * setActiveConversation(null);
 * ```
 */
export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

/**
 * Gets the currently active conversation ID
 * @returns The active conversation ID or null
 */
export function getActiveConversation(): string | null {
  return activeConversationId;
}

/**
 * Configure notification handler for foreground notifications
 * Suppresses alerts for messages in the currently active conversation
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Get notification data
    const data = notification.request.content.data as unknown as NotificationData;

    // Story 5.3: Crisis alerts ALWAYS show (never suppressed)
    const isCrisisAlert = data.type === 'crisis_detection' || data.notificationType === 'crisis_detection';

    if (isCrisisAlert) {
      // Crisis alerts bypass all suppression and always show
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }

    // Check if app is in foreground
    const appState = AppState.currentState;
    const isInForeground = appState === 'active';

    // Check if notification is for active conversation
    const isActiveConversation = data.conversationId === activeConversationId;

    // Suppress notification if user is viewing the conversation
    const shouldSuppress = isInForeground && isActiveConversation;

    // Check preferences
    const shouldShowByPreferences = await shouldShowNotification(data.type);

    // Final decision: show if not suppressed AND preferences allow
    const shouldShow = !shouldSuppress && shouldShowByPreferences;

    return {
      shouldShowAlert: shouldShow,
      shouldPlaySound: shouldShow,
      shouldSetBadge: true, // Always update badge
      shouldShowBanner: shouldShow,
      shouldShowList: shouldShow,
    };
  },
});

/**
 * Checks if notification should be shown based on preferences
 * @param _type - Notification category type (currently unused, will be used with preferences)
 * @returns Promise resolving to whether notification should show
 */
async function shouldShowNotification(_type: NotificationCategory): Promise<boolean> {
  // TODO: Load user preferences from Firestore/AsyncStorage
  // For now, show all notifications
  return true;
}

/**
 * Notification service class for managing push notifications
 */
class NotificationService {
  private notificationListener: EventSubscription | null = null;
  private responseListener: EventSubscription | null = null;
  private backgroundListener: EventSubscription | null = null;
  private preferences: NotificationPreferences | null = null;

  /**
   * Registers for push notifications and requests permissions
   * @returns Promise resolving to the push token (Expo or native) or null
   * @remarks
   * Automatically detects Expo Go vs native build and uses appropriate token type
   * @example
   * ```typescript
   * const token = await notificationService.registerForPushNotificationsAsync();
   * if (token) {
   *   console.log('Push token:', token);
   * }
   * ```
   */
  async registerForPushNotificationsAsync(): Promise<string | null> {
    // Only works on physical devices
    if (!Device.isDevice) {
      console.warn('[NotificationService] Push notifications only work on physical devices');
      return null;
    }

    try {
      // Delegate to fcmTokenService which handles Expo vs native detection
      const token = await fcmTokenService.getToken();

      if (token) {
        // Configure notification channels
        await this.configureNotificationChannels();
      }

      return token;
    } catch (error) {
      console.error('[NotificationService] Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Configures platform-specific notification channels
   * @private
   */
  private async configureNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      // Messages channel
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        description: 'Direct message notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0084FF',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Group messages channel
      await Notifications.setNotificationChannelAsync('groups', {
        name: 'Group Messages',
        description: 'Group message notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00C853',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // System channel
      await Notifications.setNotificationChannelAsync('system', {
        name: 'System',
        description: 'System notifications and updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150],
        lightColor: '#FF9800',
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
      });

      // Crisis alerts channel (Story 5.3)
      await Notifications.setNotificationChannelAsync('crisis_alerts', {
        name: 'Crisis Alerts',
        description: 'High-priority alerts for negative sentiment detection',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#EF4444', // Red
        sound: 'urgent_alert',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // Business opportunity alerts channel (Story 5.6)
      await Notifications.setNotificationChannelAsync('business_opportunities', {
        name: 'Business Opportunities',
        description: 'High-value business opportunities and sponsorship inquiries',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#6C63FF', // Purple (brand color)
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });

      // Daily digest channel (Story 5.8)
      await Notifications.setNotificationChannelAsync('daily_digest', {
        name: 'Daily Digest',
        description: 'Daily AI workflow summaries and suggestions',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: '#0084FF', // Blue
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    }
  }

  /**
   * Sends a push notification when daily digest is ready (Story 5.8 - Task 13)
   * @param userId - The user ID receiving the notification
   * @param digestSummary - Summary of digest contents
   * @param digestSummary.totalHandled - Number of conversations handled automatically
   * @param digestSummary.needReview - Number of suggestions needing review
   * @param digestSummary.errors - Number of errors encountered
   * @param digestSummary.digestId - ID of the digest for deep linking
   * @param digestSummary.date - Date of the digest (YYYY-MM-DD)
   * @returns Promise that resolves when notification is sent
   * @throws {Error} When notification fails to send
   * @remarks
   * Respects user's quiet hours settings. Only sends if:
   * - Outside quiet hours OR
   * - User has no quiet hours configured
   *
   * Deep links to: yipyap://daily-digest?date={date}
   * @example
   * ```typescript
   * await sendDailyDigestNotification('user123', {
   *   totalHandled: 5,
   *   needReview: 3,
   *   errors: 0,
   *   digestId: 'digest-456',
   *   date: '2025-10-24'
   * });
   * ```
   */
  async sendDailyDigestNotification(
    userId: string,
    digestSummary: {
      totalHandled: number;
      needReview: number;
      errors: number;
      digestId: string;
      date: string;
    }
  ): Promise<void> {
    try {
      // Check quiet hours - don't send if in quiet hours
      if (this.preferences && this.isInQuietHours()) {
        console.log('[NotificationService] Skipping daily digest notification - in quiet hours');
        return;
      }

      const { totalHandled, needReview, errors, digestId, date } = digestSummary;

      // Build notification body based on digest contents
      let body = '';
      if (errors > 0) {
        body = `⚠️ ${errors} error${errors > 1 ? 's' : ''} occurred. Please review.`;
      } else if (needReview > 0) {
        body = `${totalHandled} handled, ${needReview} need${needReview > 1 ? '' : 's'} your review`;
      } else if (totalHandled > 0) {
        body = `${totalHandled} conversation${totalHandled > 1 ? 's' : ''} handled automatically`;
      } else {
        body = 'Your daily digest is ready';
      }

      // Build notification data for deep linking
      const notificationData = {
        type: 'daily_digest' as NotificationCategory,
        timestamp: new Date().toISOString(),
        digestId,
        date,
        userId,
        // Deep link params
        screen: 'daily-digest',
        params: { date },
      };

      const channelId = Platform.OS === 'android' ? 'daily_digest' : undefined;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Daily Digest Ready',
          body,
          data: notificationData as Record<string, unknown>,
          sound: this.preferences?.sound !== false ? 'default' : undefined,
          badge: (await this.getBadgeCount()) + 1,
          ...(channelId && { channelId }),
        },
        trigger: null, // Show immediately
      });

      // Update badge count
      await this.incrementBadgeCount();

      console.log('[NotificationService] Daily digest notification sent successfully');
    } catch (error) {
      console.error('[NotificationService] Error sending daily digest notification:', error);
      throw error;
    }
  }

  /**
   * Shows a local notification when a new message is received
   * @param message - The message to display in notification
   * @param senderName - Name of the message sender
   * @param conversationName - Name of the conversation (for group chats)
   * @param type - Type of notification (message, group, system)
   * @param showPreview - Whether to show message preview
   * @example
   * ```typescript
   * await notificationService.showNewMessageNotification(
   *   message,
   *   'John Doe',
   *   'Team Chat',
   *   'group',
   *   true
   * );
   * ```
   */
  async showNewMessageNotification(
    message: Message,
    senderName: string,
    conversationName?: string,
    type: NotificationCategory = 'message',
    showPreview: boolean = true
  ): Promise<void> {
    try {
      // Check if we should show this notification based on preferences
      if (this.preferences) {
        if (!this.preferences.enabled) return;

        if (type === 'message' && !this.preferences.directMessages) return;
        if (type === 'group' && !this.preferences.groupMessages) return;
        if (type === 'system' && !this.preferences.systemMessages) return;

        // Check quiet hours
        if (this.isInQuietHours()) return;

        // Override showPreview based on preferences
        showPreview = this.preferences.showPreview && showPreview;
      }

      const notificationData = {
        conversationId: message.conversationId,
        senderId: message.senderId,
        messageId: message.id,
        type,
        timestamp: new Date().toISOString(),
      };

      const channelId = type === 'group' ? 'groups' : type === 'system' ? 'system' : 'messages';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: conversationName || senderName,
          body: showPreview ? `${senderName}: ${message.text}` : 'New message',
          data: notificationData as Record<string, unknown>,
          sound: this.preferences?.sound !== false ? 'default' : undefined,
          badge: await this.getUnreadCount() + 1,
          ...(Platform.OS === 'android' && { channelId }),
        },
        trigger: null, // Show immediately
      });

      // Update badge count
      await this.incrementBadgeCount();
    } catch (error) {
      console.error('[NotificationService] Error showing notification:', error);
    }
  }

  /**
   * Checks if current time is within quiet hours
   * @returns True if in quiet hours
   * @private
   */
  private isInQuietHours(): boolean {
    if (!this.preferences?.quietHoursStart || !this.preferences?.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = this.preferences.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Gets the current unread count
   * @returns Promise resolving to unread count
   * @private
   */
  private async getUnreadCount(): Promise<number> {
    // TODO: Integrate with conversation service to get actual unread count
    // For now, get current badge count
    try {
      return await Notifications.getBadgeCountAsync();
    } catch {
      return 0;
    }
  }

  /**
   * Increments the badge count by 1
   */
  async incrementBadgeCount(): Promise<void> {
    try {
      const current = await Notifications.getBadgeCountAsync();
      await Notifications.setBadgeCountAsync(current + 1);
    } catch (error) {
      console.error('[NotificationService] Error incrementing badge:', error);
    }
  }

  /**
   * Sets up notification listeners including background messages
   * @param onNotificationReceived - Callback when notification is received (foreground)
   * @param onNotificationResponse - Callback when user interacts with notification
   * @param onBackgroundMessage - Callback when background notification is received
   * @returns Cleanup function to remove listeners
   * @example
   * ```typescript
   * const cleanup = notificationService.addNotificationListeners(
   *   (notification) => console.log('Received:', notification),
   *   (response) => console.log('Clicked:', response),
   *   (notification) => console.log('Background:', notification)
   * );
   * // Later: cleanup();
   * ```
   */
  addNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void,
    onBackgroundMessage?: (notification: Notifications.Notification) => void
  ): () => void {
    // Remove existing listeners
    this.removeNotificationListeners();

    // Add notification received listener (foreground)
    if (onNotificationReceived) {
      this.notificationListener =
        Notifications.addNotificationReceivedListener(onNotificationReceived);
    }

    // Add notification response listener (user interaction/tap)
    if (onNotificationResponse) {
      this.responseListener =
        Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
    }

    // Add background notification listener
    // Note: expo-notifications handles background notifications automatically
    // This listener will be called when the app is in background/killed state
    if (onBackgroundMessage) {
      this.backgroundListener =
        Notifications.addNotificationReceivedListener((notification) => {
          // Check if app is in background
          // Background notifications are handled automatically by the OS
          // This provides a hook for custom background processing
          onBackgroundMessage(notification);
        });
    }

    // Return cleanup function
    return () => this.removeNotificationListeners();
  }

  /**
   * Removes all notification listeners
   */
  removeNotificationListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
    if (this.backgroundListener) {
      this.backgroundListener.remove();
      this.backgroundListener = null;
    }
  }

  /**
   * Sets notification preferences
   * @param preferences - User notification preferences
   * @example
   * ```typescript
   * notificationService.setPreferences({
   *   enabled: true,
   *   showPreview: true,
   *   sound: true,
   *   vibration: true,
   *   directMessages: true,
   *   groupMessages: true,
   *   systemMessages: false,
   *   quietHoursStart: '22:00',
   *   quietHoursEnd: '08:00'
   * });
   * ```
   */
  setPreferences(preferences: NotificationPreferences): void {
    this.preferences = preferences;
  }

  /**
   * Gets current notification preferences
   * @returns Current preferences or null
   */
  getPreferences(): NotificationPreferences | null {
    return this.preferences;
  }

  /**
   * Checks if notification permissions are granted
   * @returns Promise resolving to permission status
   * @example
   * ```typescript
   * const hasPermission = await notificationService.checkPermissions();
   * if (!hasPermission) {
   *   // Show permission request UI
   * }
   * ```
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[NotificationService] Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Requests notification permissions from the user
   * @returns Promise resolving to whether permissions were granted
   * @example
   * ```typescript
   * const granted = await notificationService.requestPermissions();
   * if (granted) {
   *   // Initialize notifications
   * }
   * ```
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[NotificationService] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Updates badge count to specific value
   * @param count - New badge count
   * @example
   * ```typescript
   * await notificationService.updateBadgeCount(5);
   * ```
   */
  async updateBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(Math.max(0, count));
    } catch (error) {
      console.error('[NotificationService] Error updating badge count:', error);
    }
  }

  /**
   * Clears all badges
   */
  async clearBadge(): Promise<void> {
    await this.updateBadgeCount(0);
  }

  /**
   * Cancels all scheduled notifications
   * @returns Promise that resolves when notifications are cancelled
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Gets the current badge count
   * @returns Promise resolving to the badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Sets the badge count
   * @param count - The new badge count
   * @returns Promise that resolves when badge is set
   */
  async setBadgeCount(count: number): Promise<boolean> {
    return await Notifications.setBadgeCountAsync(count);
  }
}

/**
 * Checks if current time is within opportunity notification quiet hours (Story 5.6 - Task 10)
 * @param quietHours - Quiet hours configuration from user settings
 * @returns True if in quiet hours, false otherwise
 * @remarks
 * Handles midnight crossover (e.g., start: "22:00", end: "08:00")
 * @example
 * ```typescript
 * const inQuietHours = isInQuietHoursForOpportunities({
 *   start: '22:00',
 *   end: '08:00'
 * });
 * ```
 */
export function isInQuietHoursForOpportunities(quietHours: {
  start: string;
  end: string;
}): boolean {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const { start, end } = quietHours;

  // Handle midnight crossover (e.g., 22:00 to 08:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}

/**
 * Checks if an opportunity notification should be sent based on user settings (Story 5.6 - Task 10)
 * @param userId - The recipient user ID
 * @param message - The message with opportunity metadata
 * @returns Promise resolving to true if notification should be sent
 * @throws {Error} When failing to load user settings
 * @remarks
 * Checks:
 * - Settings enabled
 * - Score >= user's minimum threshold
 * - Type is enabled in notifyByType
 * - Not in quiet hours
 * @example
 * ```typescript
 * const shouldNotify = await shouldSendOpportunityNotification('user123', message);
 * if (shouldNotify) {
 *   await sendOpportunityNotification('user123', message);
 * }
 * ```
 */
export async function shouldSendOpportunityNotification(
  userId: string,
  message: Message
): Promise<boolean> {
  try {
    // Load user's opportunity notification settings
    const settings = await getOpportunityNotificationSettings(userId);

    // If no settings or disabled, don't notify
    if (!settings || !settings.enabled) {
      return false;
    }

    // Check if score meets minimum threshold
    const score = message.metadata.opportunityScore || 0;
    if (score < settings.minimumScore) {
      return false;
    }

    // Check if type is enabled for notifications
    const type = message.metadata.opportunityType;
    if (type && !settings.notifyByType[type]) {
      return false;
    }

    // Check quiet hours
    if (settings.quietHours?.enabled && settings.quietHours.start && settings.quietHours.end) {
      if (isInQuietHoursForOpportunities(settings.quietHours)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking opportunity notification settings:', error);
    // Fail open - if we can't check settings, don't send notification
    return false;
  }
}

/**
 * Sends a push notification for a high-value business opportunity (Story 5.6 - Task 10)
 * @param message - The message containing opportunity data
 * @param senderName - Name of the sender
 * @param conversationName - Name of the conversation (optional, for groups)
 * @returns Promise that resolves when notification is sent
 * @throws {Error} When notification fails to send
 * @remarks
 * Notification includes:
 * - Title: "New Business Opportunity"
 * - Body: Score, type, and sender info
 * - Data: conversationId and messageId for deep linking
 * @example
 * ```typescript
 * await sendOpportunityNotification(message, 'John Doe', 'Brand Deals');
 * ```
 */
export async function sendOpportunityNotification(
  message: Message,
  senderName: string,
  conversationName?: string
): Promise<void> {
  try {
    const score = message.metadata.opportunityScore || 0;
    const type = message.metadata.opportunityType || 'opportunity';
    const analysis = message.metadata.opportunityAnalysis || '';

    // Format type for display
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

    // Build notification data for deep linking
    const notificationData = {
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageId: message.id,
      type: 'business_opportunity' as NotificationCategory,
      timestamp: new Date().toISOString(),
      opportunityScore: score,
      opportunityType: type,
    };

    const channelId = Platform.OS === 'android' ? 'business_opportunities' : undefined;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💼 ${typeLabel} Opportunity (Score: ${score})`,
        body: `${senderName}${conversationName ? ` in ${conversationName}` : ''}: ${analysis || message.text.substring(0, 100)}`,
        data: notificationData as Record<string, unknown>,
        sound: 'default',
        badge: (await notificationService.getBadgeCount()) + 1,
        ...(channelId && { channelId }),
      },
      trigger: null, // Show immediately
    });

    // Update badge count
    await notificationService.incrementBadgeCount();
  } catch (error) {
    console.error('[NotificationService] Error sending opportunity notification:', error);
    throw error;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
