/**
 * Device identification utility for multi-device presence tracking
 * @module utils/deviceId
 *
 * @remarks
 * Generates and persists a unique device identifier for presence system.
 * Each device gets a UUID stored in AsyncStorage for consistency across app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@yipyap:deviceId';

/**
 * Generates a UUID v4 compliant identifier
 * @returns UUID string
 * @example
 * ```typescript
 * const id = generateUUID(); // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 * ```
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gets or creates a persistent device identifier
 * @returns Promise resolving to the device ID
 * @throws {Error} When AsyncStorage fails
 *
 * @example
 * ```typescript
 * const deviceId = await getDeviceId();
 * console.log(`Device: ${deviceId}`);
 * ```
 *
 * @remarks
 * - Creates new UUID on first call
 * - Persists to AsyncStorage for consistency
 * - Returns same ID across app restarts
 * - Never expires or rotates
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    // Generate and store new ID if not found
    if (!deviceId) {
      deviceId = generateUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Failed to get/set device ID:', error);
    // Fallback to session-only UUID if storage fails
    // This is less ideal but allows app to continue functioning
    return generateUUID();
  }
}

/**
 * Gets the current platform identifier
 * @returns Platform string ('ios' | 'android' | 'web')
 *
 * @example
 * ```typescript
 * const platform = getPlatform(); // 'ios' or 'android' or 'web'
 * ```
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  const os = Platform.OS;
  if (os === 'ios' || os === 'android') {
    return os;
  }
  // Fallback to 'web' for any other platform
  return 'web';
}

/**
 * Clears the stored device ID (for testing/debugging only)
 * @returns Promise that resolves when cleared
 *
 * @remarks
 * This should only be used in development/testing.
 * Clearing device ID will create a new presence entry on next app launch.
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
  } catch (error) {
    console.error('Failed to clear device ID:', error);
  }
}
