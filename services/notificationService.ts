/**
 * Notification service for handling push notifications
 * @module services/notificationService
 * @remarks
 * Handles foreground and background notifications with FCM integration.
 * Supports deep linking, notification categories, and badge management.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import type { Message } from '@/types/models';
import type { NotificationPreferences } from '@/types/user';
import { fcmTokenService } from './fcmTokenService';

/**
 * Notification category types
 */
export type NotificationCategory = 'message' | 'group' | 'system';

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
 * Configure notification handler for foreground notifications
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Get notification data
    const data = notification.request.content.data as unknown as NotificationData;

    // Check if we should show based on preferences (will be enhanced)
    const shouldShow = await shouldShowNotification(data.type);

    return {
      shouldShowAlert: shouldShow,
      shouldPlaySound: shouldShow,
      shouldSetBadge: true,
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

// Export singleton instance
export const notificationService = new NotificationService();
