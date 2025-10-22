/**
 * Hook for managing notifications
 * @module hooks/useNotifications
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook that manages notification permissions and listeners
 * @returns Object with notification state and methods
 * @example
 * ```tsx
 * function App() {
 *   const { hasPermission, lastNotification } = useNotifications();
 *
 *   if (lastNotification) {
 *     console.log('New notification:', lastNotification);
 *   }
 * }
 * ```
 */
export function useNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Register for push notifications
    const setupNotifications = async () => {
      const token = await notificationService.registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        setHasPermission(true);
      }
    };

    setupNotifications();

    // Add notification listeners
    const cleanup = notificationService.addNotificationListeners(
      // When notification received in foreground
      (notification) => {
        console.warn('Notification received:', notification);
        setLastNotification(notification);
      },
      // When user taps on notification
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.conversationId) {
          // Navigate to the conversation
          router.push(`/(tabs)/conversations/${data.conversationId}`);
        }
      }
    );

    // Cleanup on unmount
    return cleanup;
  }, [user?.uid, router]);

  return {
    hasPermission,
    expoPushToken,
    lastNotification,
    clearLastNotification: () => setLastNotification(null),
  };
}
