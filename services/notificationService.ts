/**
 * Notification service for handling push notifications
 * @module services/notificationService
 * @remarks
 * Handles foreground notifications for the MVP.
 * Future enhancements will include background and FCM support.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import type { Message } from '@/types/models';

/**
 * Configure notification handler for foreground notifications
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Notification service class for managing push notifications
 */
class NotificationService {
  private notificationListener: EventSubscription | null = null;
  private responseListener: EventSubscription | null = null;

  /**
   * Registers for push notifications and requests permissions
   * @returns Promise resolving to the Expo push token or null
   * @example
   * ```typescript
   * const token = await notificationService.registerForPushNotificationsAsync();
   * if (token) {
   *   console.log('Push token:', token);
   * }
   * ```
   */
  async registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    // Only works on physical devices
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    try {
      // Check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push notification permissions');
        return null;
      }

      // Get Expo push token
      const tokenResponse = await Notifications.getExpoPushTokenAsync();
      token = tokenResponse.data;

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }

    return token;
  }

  /**
   * Shows a local notification when a new message is received
   * @param message - The message to display in notification
   * @param senderName - Name of the message sender
   * @param conversationName - Name of the conversation
   * @example
   * ```typescript
   * await notificationService.showNewMessageNotification(
   *   message,
   *   'John Doe',
   *   'Team Chat'
   * );
   * ```
   */
  async showNewMessageNotification(
    message: Message,
    senderName: string,
    conversationName?: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: conversationName || senderName,
          body: `${senderName}: ${message.text}`,
          data: {
            messageId: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
          },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Sets up notification listeners
   * @param onNotificationReceived - Callback when notification is received
   * @param onNotificationResponse - Callback when user interacts with notification
   * @returns Cleanup function to remove listeners
   * @example
   * ```typescript
   * const cleanup = notificationService.addNotificationListeners(
   *   (notification) => console.log('Received:', notification),
   *   (response) => console.log('Clicked:', response)
   * );
   * // Later: cleanup();
   * ```
   */
  addNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): () => void {
    // Remove existing listeners
    this.removeNotificationListeners();

    // Add notification received listener (foreground)
    if (onNotificationReceived) {
      this.notificationListener =
        Notifications.addNotificationReceivedListener(onNotificationReceived);
    }

    // Add notification response listener (user interaction)
    if (onNotificationResponse) {
      this.responseListener =
        Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
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
