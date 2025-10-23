/**
 * Notification permission helpers
 * @module utils/notificationPermissions
 *
 * @remarks
 * Manages notification permission state and first-launch prompting
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSION_REQUESTED_KEY = '@yipyap:notification_permission_requested';

/**
 * Checks if notification permission has been requested before
 * @returns Promise resolving to true if already requested
 * @example
 * ```typescript
 * const hasRequested = await hasRequestedNotificationPermission();
 * if (!hasRequested) {
 *   // Show permission prompt
 * }
 * ```
 */
export async function hasRequestedNotificationPermission(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
    return value === 'true';
  } catch (error) {
    console.error('[notificationPermissions] Error checking permission state:', error);
    return false; // Default to false to show prompt
  }
}

/**
 * Marks notification permission as requested
 * @returns Promise that resolves when state is saved
 * @example
 * ```typescript
 * await markNotificationPermissionRequested();
 * ```
 */
export async function markNotificationPermissionRequested(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
  } catch (error) {
    console.error('[notificationPermissions] Error saving permission state:', error);
  }
}

/**
 * Resets notification permission state (for testing)
 * @returns Promise that resolves when state is cleared
 * @example
 * ```typescript
 * await resetNotificationPermissionState();
 * ```
 */
export async function resetNotificationPermissionState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PERMISSION_REQUESTED_KEY);
  } catch (error) {
    console.error('[notificationPermissions] Error resetting permission state:', error);
  }
}
