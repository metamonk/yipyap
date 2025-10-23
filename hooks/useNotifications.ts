/**
 * Hook for managing notifications
 * @module hooks/useNotifications
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/services/notificationService';
import { fcmTokenService } from '@/services/fcmTokenService';
import { getConversation } from '@/services/conversationService';
import { useAuth } from '@/hooks/useAuth';
import {
  hasRequestedNotificationPermission,
  markNotificationPermissionRequested
} from '@/utils/notificationPermissions';

/**
 * Hook that manages notification permissions and listeners
 * @returns Object with notification state and methods
 * @example
 * ```tsx
 * function App() {
 *   const { hasPermission, requestPermission } = useNotifications();
 *
 *   if (!hasPermission) {
 *     await requestPermission();
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
  const [shouldPrompt, setShouldPrompt] = useState(false);

  // Check if we should show permission prompt
  useEffect(() => {
    const checkPermissionState = async () => {
      if (!user?.uid) return;

      const alreadyRequested = await hasRequestedNotificationPermission();
      const granted = await notificationService.checkPermissions();

      if (granted) {
        setHasPermission(true);
        // Don't need to prompt if already granted
        setShouldPrompt(false);
      } else if (!alreadyRequested) {
        // Haven't requested yet and not granted - should prompt
        setShouldPrompt(true);
      } else {
        // Already requested but denied - don't prompt again
        setShouldPrompt(false);
      }
    };

    checkPermissionState();
  }, [user?.uid]);

  // Register for push notifications if permission granted
  useEffect(() => {
    if (!user?.uid || !hasPermission) return;

    const setupNotifications = async () => {
      try {
        // Register for push notifications
        const token = await notificationService.registerForPushNotificationsAsync();
        if (token) {
          setExpoPushToken(token);

          // Save token to Firestore
          await fcmTokenService.registerToken(user.uid);
        }
      } catch (error) {
        console.error('[useNotifications] Error setting up notifications:', error);
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
      async (response) => {
        try {
          const data = response.notification.request.content.data;
          if (data?.conversationId) {
            const conversationId = data.conversationId as string;

            // Security: Verify user is authorized to access this conversation
            // before navigating to prevent unauthorized access via deep links
            const conversation = await getConversation(conversationId);

            if (!conversation) {
              // Conversation no longer exists
              console.warn('[useNotifications] Conversation not found:', conversationId);
              Alert.alert(
                'Conversation Not Found',
                'This conversation may have been deleted.',
                [{ text: 'OK' }]
              );
              router.push('/(tabs)/conversations');
              return;
            }

            // Check if current user is a participant
            if (!conversation.participantIds.includes(user.uid)) {
              // User is not authorized to access this conversation
              console.warn('[useNotifications] Unauthorized access attempt to conversation:', conversationId);
              Alert.alert(
                'Access Denied',
                'You do not have permission to view this conversation.',
                [{ text: 'OK' }]
              );
              router.push('/(tabs)/conversations');
              return;
            }

            // User is authorized - navigate to conversation
            router.push(`/(tabs)/conversations/${conversationId}`);
          }
        } catch (error) {
          console.error('[useNotifications] Error handling notification tap:', error);
          Alert.alert(
            'Error',
            'Could not open conversation. Please try again.',
            [{ text: 'OK' }]
          );
          // Navigate to conversations list as fallback
          router.push('/(tabs)/conversations');
        }
      }
    );

    // Cleanup on unmount
    return cleanup;
  }, [user?.uid, hasPermission, router]);

  /**
   * Requests notification permissions from the user
   * @returns Promise resolving to whether permission was granted
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await notificationService.requestPermissions();
      setHasPermission(granted);
      setShouldPrompt(false);

      // Mark as requested regardless of outcome
      await markNotificationPermissionRequested();

      return granted;
    } catch (error) {
      console.error('[useNotifications] Error requesting permission:', error);
      await markNotificationPermissionRequested();
      return false;
    }
  }, []);

  return {
    hasPermission,
    expoPushToken,
    lastNotification,
    shouldPrompt,
    requestPermission,
    clearLastNotification: () => setLastNotification(null),
  };
}
