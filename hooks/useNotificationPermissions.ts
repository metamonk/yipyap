/**
 * Custom hook for managing notification permissions
 * @module hooks/useNotificationPermissions
 *
 * @remarks
 * Handles notification permission state, requests, and status tracking.
 * Provides an easy interface for components to check and request permissions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PermissionResponse } from 'expo-notifications';

/**
 * Return type for useNotificationPermissions hook
 */
export interface NotificationPermissionsState {
  /** Current permission status */
  status: PermissionResponse | null;

  /** Whether permissions are granted */
  granted: boolean;

  /** Whether permissions can be requested */
  canAskAgain: boolean;

  /** Whether permission check is in progress */
  loading: boolean;

  /** Function to request permissions */
  requestPermissions: () => Promise<boolean>;

  /** Function to open app settings */
  openSettings: () => void;

  /** Function to refresh permission status */
  checkPermissions: () => Promise<void>;
}

/**
 * Custom hook for managing notification permissions
 *
 * @param checkOnMount - Whether to check permissions on mount (default: true)
 * @param onPermissionChange - Callback when permission status changes
 * @returns Notification permission state and control functions
 *
 * @example
 * ```tsx
 * function NotificationSetup() {
 *   const {
 *     granted,
 *     canAskAgain,
 *     requestPermissions,
 *     openSettings
 *   } = useNotificationPermissions();
 *
 *   if (!granted) {
 *     return (
 *       <View>
 *         <Text>Notifications disabled</Text>
 *         {canAskAgain ? (
 *           <Button title="Enable" onPress={requestPermissions} />
 *         ) : (
 *           <Button title="Open Settings" onPress={openSettings} />
 *         )}
 *       </View>
 *     );
 *   }
 *
 *   return <Text>Notifications enabled</Text>;
 * }
 * ```
 */
export function useNotificationPermissions(
  checkOnMount: boolean = true,
  onPermissionChange?: (granted: boolean) => void
): NotificationPermissionsState {
  const [status, setStatus] = useState<PermissionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Opens device settings to notification settings
   */
  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  /**
   * Checks current permission status
   */
  const checkPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const permissionResponse = await Notifications.getPermissionsAsync();

      setStatus((prevStatus) => {
        // Call callback if permission changed
        if (onPermissionChange) {
          const wasGranted = prevStatus?.status === 'granted';
          const isGranted = permissionResponse.status === 'granted';

          if (wasGranted !== isGranted) {
            onPermissionChange(isGranted);
          }
        }
        return permissionResponse;
      });
    } catch (error) {
      console.error('[useNotificationPermissions] Error checking permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [onPermissionChange]); // Remove status from dependencies to prevent infinite loop

  /**
   * Requests notification permissions with user-friendly flow
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);

      // Check if we can ask again
      const current = await Notifications.getPermissionsAsync();

      if (!current.canAskAgain && current.status !== 'granted') {
        // User previously denied, show instructions to enable in settings
        Alert.alert(
          'Notifications Disabled',
          'You previously denied notification permissions. Please enable them in your device settings.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: openSettings,
            },
          ]
        );
        return false;
      }

      if (current.status === 'granted') {
        return true;
      }

      // Show explanation before requesting
      const shouldRequest = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Enable Notifications',
          'Get notified when you receive new messages, even when the app is closed.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Enable',
              onPress: () => resolve(true),
            },
          ]
        );
      });

      if (!shouldRequest) {
        return false;
      }

      // Request permissions
      const permissionResponse = await Notifications.requestPermissionsAsync();
      setStatus(permissionResponse);

      const granted = permissionResponse.status === 'granted';

      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          'You can enable notifications later in Settings.',
          [{ text: 'OK' }]
        );
      }

      // Call callback if provided
      if (onPermissionChange) {
        onPermissionChange(granted);
      }

      return granted;
    } catch (error) {
      console.error('[useNotificationPermissions] Error requesting permissions:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [onPermissionChange, openSettings]);

  // Check permissions on mount if requested
  useEffect(() => {
    if (checkOnMount) {
      checkPermissions();
    }
  }, [checkOnMount, checkPermissions]);

  return {
    status,
    granted: status?.status === 'granted',
    canAskAgain: status?.canAskAgain ?? true,
    loading,
    requestPermissions,
    openSettings,
    checkPermissions,
  };
}
