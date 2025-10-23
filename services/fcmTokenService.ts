/**
 * Push Token Management Service
 * @module services/fcmTokenService
 *
 * @remarks
 * Handles push notification token lifecycle with dual support:
 * - Expo Push Tokens (for Expo Go testing)
 * - Native FCM/APNs tokens (for production builds)
 * - Token generation and registration
 * - Multi-device support
 * - Token refresh handling
 * - Token validation and cleanup
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { PushToken, FCMToken } from '@/types/user';
import { detectTokenType, isExpoGo } from '@/utils/tokenUtils';

/**
 * Maximum age for FCM tokens before considering them stale (90 days)
 */
const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Maximum number of devices to keep per user
 */
const MAX_DEVICES_PER_USER = 5;

/**
 * FCM Token Service class for managing push notification tokens
 *
 * @remarks
 * Provides comprehensive token management including:
 * - Multi-device support
 * - Automatic token refresh
 * - Stale token cleanup
 * - Platform-specific handling
 */
class FCMTokenService {
  private currentToken: string | null = null;
  private tokenRefreshListener: (() => void) | null = null;

  /**
   * Registers push token for the current device (auto-detects Expo vs native)
   *
   * @param userId - Firebase Auth user ID
   * @returns Promise resolving to token string or null if unavailable
   * @throws {Error} When registration fails
   *
   * @example
   * ```typescript
   * const token = await fcmTokenService.registerToken('user123');
   * ```
   */
  async registerToken(userId: string): Promise<string | null> {
    try {
      const token = await this.getToken();
      if (token) {
        await this.savePushToken(userId, token);
      }
      return token;
    } catch (error) {
      console.error('[FCMTokenService] Error registering token:', error);
      throw error;
    }
  }

  /**
   * Gets push token for the current device (auto-detects Expo vs native)
   *
   * @returns Promise resolving to push token or null if unavailable
   * @throws {Error} When token generation fails
   *
   * @example
   * ```typescript
   * const token = await fcmTokenService.getToken();
   * ```
   */
  async getToken(): Promise<string | null> {
    // Only works on physical devices
    if (!Device.isDevice) {
      console.warn('[FCMTokenService] Push notifications only work on physical devices');
      return null;
    }

    try {
      // Check/request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[FCMTokenService] Push notification permissions not granted');
        return null;
      }

      // Auto-detect Expo Go vs native build
      let token: string;

      if (isExpoGo()) {
        // Use Expo Push Token for Expo Go
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        token = tokenData.data;
        console.warn('[FCMTokenService] Using Expo Push Token for Expo Go');
      } else {
        // Use native FCM/APNs token for production builds
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data;
        console.warn('[FCMTokenService] Using native FCM/APNs token');
      }

      this.currentToken = token;
      return token;
    } catch (error) {
      console.error('[FCMTokenService] Error getting push token:', error);
      throw new Error(`Failed to get push token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets the FCM token for the current device
   *
   * @deprecated Use getToken() instead for automatic Expo/native detection
   * @returns Promise resolving to FCM token or null if unavailable
   * @throws {Error} When token generation fails
   *
   * @example
   * ```typescript
   * const token = await fcmTokenService.getFCMToken();
   * if (token) {
   *   await fcmTokenService.saveFCMToken(userId, token);
   * }
   * ```
   */
  async getFCMToken(): Promise<string | null> {
    // Only works on physical devices
    if (!Device.isDevice) {
      console.warn('[FCMTokenService] Push notifications only work on physical devices');
      return null;
    }

    try {
      // Check/request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[FCMTokenService] Push notification permissions not granted');
        return null;
      }

      // Get device push token (platform-specific)
      let token: string;

      if (Platform.OS === 'android') {
        // For Android, get Firebase token directly
        // This assumes Firebase is properly configured with google-services.json
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data;
      } else if (Platform.OS === 'ios') {
        // For iOS, get APNs token
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data;
      } else {
        console.warn('[FCMTokenService] Unsupported platform:', Platform.OS);
        return null;
      }

      this.currentToken = token;
      return token;
    } catch (error) {
      console.error('[FCMTokenService] Error getting FCM token:', error);
      throw new Error(`Failed to get FCM token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Saves or updates push token in user's Firestore document (auto-detects token type)
   *
   * @param userId - Firebase Auth user ID
   * @param token - Push token to save (Expo or native)
   * @returns Promise resolving to the saved push token object
   * @throws {Error} When save operation fails
   *
   * @example
   * ```typescript
   * const token = await fcmTokenService.getToken();
   * if (token) {
   *   await fcmTokenService.savePushToken('user123', token);
   * }
   * ```
   */
  async savePushToken(userId: string, token: string): Promise<PushToken> {
    try {
      const deviceId = await this.getDeviceId();
      const platform = Platform.OS as 'ios' | 'android';
      const appVersion = Constants.expoConfig?.version || '1.0.0';
      const tokenType = detectTokenType(token);

      const pushToken: PushToken = {
        token,
        type: tokenType,
        platform,
        deviceId,
        appVersion,
        createdAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
      };

      const userRef = doc(getFirebaseDb(), 'users', userId);

      // First, remove any existing token for this device
      await this.removeTokenForDevice(userId, deviceId);

      // Add the new token
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(pushToken),
      });

      // Clean up old tokens to prevent unlimited growth
      await this.cleanupOldTokens(userId);

      console.warn('[FCMTokenService] Push token saved successfully:', { deviceId, type: tokenType });
      return pushToken;
    } catch (error) {
      console.error('[FCMTokenService] Error saving push token:', error);
      throw new Error(`Failed to save push token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Saves or updates FCM token in user's Firestore document
   *
   * @deprecated Use savePushToken() instead for automatic token type detection
   * @param userId - Firebase Auth user ID
   * @param token - FCM token to save
   * @returns Promise resolving to the saved FCM token object
   * @throws {Error} When save operation fails
   *
   * @example
   * ```typescript
   * const token = await fcmTokenService.getFCMToken();
   * if (token) {
   *   await fcmTokenService.saveFCMToken('user123', token);
   * }
   * ```
   */
  async saveFCMToken(userId: string, token: string): Promise<FCMToken> {
    // Delegate to savePushToken for backward compatibility
    return this.savePushToken(userId, token);
  }

  /**
   * Removes FCM token for a specific device
   *
   * @param userId - Firebase Auth user ID
   * @param deviceId - Device identifier to remove token for
   *
   * @example
   * ```typescript
   * await fcmTokenService.removeTokenForDevice('user123', 'device-abc');
   * ```
   */
  async removeTokenForDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), 'users', userId);

      // We need to get the user document first to find matching tokens
      const userDoc = await import('firebase/firestore').then(m => m.getDoc(userRef));

      if (!userDoc.exists()) {
        console.warn('[FCMTokenService] User document not found:', userId);
        return;
      }

      const userData = userDoc.data();
      const fcmTokens = (userData.fcmTokens as PushToken[]) || [];

      // Find tokens matching this device
      const tokensToRemove = fcmTokens.filter(t => t.deviceId === deviceId);

      // Remove each matching token
      for (const tokenToRemove of tokensToRemove) {
        await updateDoc(userRef, {
          fcmTokens: arrayRemove(tokenToRemove),
        });
      }

      if (tokensToRemove.length > 0) {
        console.warn(`[FCMTokenService] Removed ${tokensToRemove.length} token(s) for device:`, deviceId);
      }
    } catch (error) {
      console.error('[FCMTokenService] Error removing device token:', error);
      // Don't throw - this is cleanup, failure shouldn't block token save
    }
  }

  /**
   * Cleans up stale tokens and enforces device limit
   *
   * @param userId - Firebase Auth user ID
   *
   * @remarks
   * - Removes tokens older than TOKEN_MAX_AGE_MS
   * - Keeps only the most recent MAX_DEVICES_PER_USER tokens
   */
  async cleanupOldTokens(userId: string): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), 'users', userId);
      const userDoc = await import('firebase/firestore').then(m => m.getDoc(userRef));

      if (!userDoc.exists()) {
        return;
      }

      const userData = userDoc.data();
      const fcmTokens = (userData.fcmTokens as PushToken[]) || [];

      if (fcmTokens.length === 0) {
        return;
      }

      const now = Date.now();
      const staleTokens: FCMToken[] = [];
      const validTokens: FCMToken[] = [];

      // Separate stale and valid tokens
      for (const token of fcmTokens) {
        const tokenAge = now - token.lastUsed.toMillis();
        if (tokenAge > TOKEN_MAX_AGE_MS) {
          staleTokens.push(token);
        } else {
          validTokens.push(token);
        }
      }

      // Remove stale tokens
      for (const staleToken of staleTokens) {
        await updateDoc(userRef, {
          fcmTokens: arrayRemove(staleToken),
        });
      }

      if (staleTokens.length > 0) {
        console.warn(`[FCMTokenService] Removed ${staleTokens.length} stale token(s)`);
      }

      // If still over limit, remove oldest tokens
      if (validTokens.length > MAX_DEVICES_PER_USER) {
        const sortedTokens = validTokens.sort((a, b) =>
          b.lastUsed.toMillis() - a.lastUsed.toMillis()
        );

        const tokensToRemove = sortedTokens.slice(MAX_DEVICES_PER_USER);

        for (const tokenToRemove of tokensToRemove) {
          await updateDoc(userRef, {
            fcmTokens: arrayRemove(tokenToRemove),
          });
        }

        console.warn(`[FCMTokenService] Removed ${tokensToRemove.length} excess token(s)`);
      }
    } catch (error) {
      console.error('[FCMTokenService] Error cleaning up old tokens:', error);
      // Don't throw - cleanup failure shouldn't block the main operation
    }
  }

  /**
   * Validates a push token format (Expo or native)
   *
   * @param token - Token to validate
   * @returns True if token appears valid
   *
   * @example
   * ```typescript
   * if (fcmTokenService.validateToken(token)) {
   *   await fcmTokenService.savePushToken(userId, token);
   * }
   * ```
   */
  validateToken(token: string): boolean {
    // Basic validation
    if (!token || typeof token !== 'string') {
      return false;
    }

    try {
      const tokenType = detectTokenType(token);

      // Expo tokens have a specific format
      if (tokenType === 'expo') {
        return token.startsWith('ExponentPushToken[') && token.endsWith(']');
      }

      // APNs tokens are exactly 64 hex characters
      if (tokenType === 'apns') {
        return token.length === 64 && /^[a-f0-9]+$/i.test(token);
      }

      // FCM tokens are typically at least 100 characters
      if (tokenType === 'fcm') {
        return token.length >= 100;
      }

      return false;
    } catch (error) {
      console.warn('[FCMTokenService] Error validating token:', error);
      return false;
    }
  }

  /**
   * Sets up token refresh listener
   *
   * @param userId - Firebase Auth user ID
   * @param onTokenRefresh - Optional callback when token refreshes
   * @returns Cleanup function to remove listener
   *
   * @example
   * ```typescript
   * const cleanup = fcmTokenService.onTokenRefresh('user123', (newToken) => {
   *   console.log('Token refreshed:', newToken);
   * });
   * // Later: cleanup();
   * ```
   */
  onTokenRefresh(
    userId: string,
    onTokenRefresh?: (token: string) => void
  ): () => void {
    // Remove existing listener
    if (this.tokenRefreshListener) {
      this.tokenRefreshListener();
      this.tokenRefreshListener = null;
    }

    // Note: expo-notifications doesn't have a built-in token refresh listener
    // We'll implement a polling mechanism or rely on app restart
    // For production, consider using native modules for more robust token refresh

    let isActive = true;
    const checkInterval = 24 * 60 * 60 * 1000; // Check once per day

    const checkTokenRefresh = async () => {
      if (!isActive) return;

      try {
        const newToken = await this.getToken();

        if (newToken && newToken !== this.currentToken) {
          console.warn('[FCMTokenService] Token refreshed');
          this.currentToken = newToken;

          // Save new token
          await this.savePushToken(userId, newToken);

          // Call callback if provided
          if (onTokenRefresh) {
            onTokenRefresh(newToken);
          }
        }
      } catch (error) {
        console.error('[FCMTokenService] Error checking token refresh:', error);
      }

      // Schedule next check
      if (isActive) {
        setTimeout(checkTokenRefresh, checkInterval);
      }
    };

    // Start checking
    checkTokenRefresh();

    // Return cleanup function
    this.tokenRefreshListener = () => {
      isActive = false;
    };

    return this.tokenRefreshListener;
  }

  /**
   * Gets unique device identifier
   *
   * @returns Promise resolving to device ID
   * @private
   */
  private async getDeviceId(): Promise<string> {
    // Use device name + model as identifier
    // In production, consider using a more robust device ID method
    const deviceName = Device.deviceName || 'unknown';
    const modelName = Device.modelName || 'unknown';
    const osVersion = Device.osVersion || 'unknown';

    return `${Platform.OS}_${modelName}_${deviceName}_${osVersion}`.replace(/\s+/g, '_');
  }

  /**
   * Updates the lastUsed timestamp for a token
   *
   * @param userId - Firebase Auth user ID
   * @param token - Token to update
   */
  async updateTokenLastUsed(userId: string, token: string): Promise<void> {
    try {
      const userRef = doc(getFirebaseDb(), 'users', userId);
      const userDoc = await import('firebase/firestore').then(m => m.getDoc(userRef));

      if (!userDoc.exists()) {
        return;
      }

      const userData = userDoc.data();
      const fcmTokens = (userData.fcmTokens as PushToken[]) || [];

      // Find and update the matching token
      const updatedTokens = fcmTokens.map(t => {
        if (t.token === token) {
          return { ...t, lastUsed: Timestamp.now() };
        }
        return t;
      });

      await updateDoc(userRef, {
        fcmTokens: updatedTokens,
      });
    } catch (error) {
      console.error('[FCMTokenService] Error updating token lastUsed:', error);
      // Don't throw - this is a non-critical update
    }
  }

  /**
   * Gets the current token (if available)
   *
   * @returns Current FCM token or null
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }
}

// Export singleton instance
export const fcmTokenService = new FCMTokenService();
