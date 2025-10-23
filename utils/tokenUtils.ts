/**
 * Token utilities for push notifications
 * @module utils/tokenUtils
 *
 * @remarks
 * Provides helpers for detecting and validating push notification token types.
 * Supports both Expo Push Tokens (for Expo Go) and native FCM/APNs tokens (for production builds).
 */

/**
 * Push token types supported by the app
 */
export type PushTokenType = 'expo' | 'fcm' | 'apns';

/**
 * Detects the type of push token
 *
 * @param token - The push token to analyze
 * @returns The detected token type
 *
 * @example
 * ```typescript
 * detectTokenType('ExponentPushToken[xxx]') // Returns 'expo'
 * detectTokenType('fKz8...') // Returns 'fcm' (Android)
 * detectTokenType('abc...') // Returns 'apns' (iOS)
 * ```
 */
export function detectTokenType(token: string): PushTokenType {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: must be a non-empty string');
  }

  // Expo push tokens have a specific format
  if (token.startsWith('ExponentPushToken[') && token.endsWith(']')) {
    return 'expo';
  }

  // FCM tokens are typically very long (152+ chars) and contain specific patterns
  // APNs tokens are 64 hex characters
  if (token.length === 64 && /^[a-f0-9]+$/i.test(token)) {
    return 'apns';
  }

  // Default to FCM for other formats (Android native tokens)
  return 'fcm';
}

/**
 * Checks if a token is an Expo push token
 *
 * @param token - The token to check
 * @returns True if the token is an Expo push token
 *
 * @example
 * ```typescript
 * isExpoToken('ExponentPushToken[xxx]') // Returns true
 * isExpoToken('fKz8...') // Returns false
 * ```
 */
export function isExpoToken(token: string): boolean {
  return detectTokenType(token) === 'expo';
}

/**
 * Checks if a token is a native FCM/APNs token
 *
 * @param token - The token to check
 * @returns True if the token is a native token
 *
 * @example
 * ```typescript
 * isNativeToken('ExponentPushToken[xxx]') // Returns false
 * isNativeToken('fKz8...') // Returns true
 * ```
 */
export function isNativeToken(token: string): boolean {
  const type = detectTokenType(token);
  return type === 'fcm' || type === 'apns';
}

/**
 * Checks if the app is running in Expo Go
 *
 * @returns True if running in Expo Go
 *
 * @remarks
 * Detects Expo Go by checking for specific environment variables and constants.
 * This helps determine whether to use Expo or native push tokens.
 */
export function isExpoGo(): boolean {
  try {
    // Check if we're in Expo Go environment
    // Expo Go doesn't have native builds, so certain modules won't be available
    // Dynamic import is needed here to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;

    // Expo Go has specific app ownership
    return Constants.appOwnership === 'expo';
  } catch {
    // If expo-constants isn't available or throws, assume not Expo Go
    return false;
  }
}
