import { Timestamp } from 'firebase/firestore';

/**
 * Username validation regex pattern
 * - Allows lowercase letters, numbers, and underscores
 * - Length must be 3-20 characters
 */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

/**
 * Minimum allowed username length
 */
export const MIN_USERNAME_LENGTH = 3;

/**
 * Maximum allowed username length
 */
export const MAX_USERNAME_LENGTH = 20;

/**
 * Maximum allowed display name length
 */
export const MAX_DISPLAY_NAME_LENGTH = 50;

/**
 * User presence status
 */
export type PresenceStatus = 'online' | 'offline';

/**
 * Represents a user's presence information
 * @remarks
 * Presence data will be fully implemented in Epic 3
 */
export interface UserPresence {
  /** Current online status of the user */
  status: PresenceStatus;

  /** Server timestamp of when user was last seen online */
  lastSeen: Timestamp;
}

/**
 * Push token types supported
 */
export type PushTokenType = 'expo' | 'fcm' | 'apns';

/**
 * Push notification token information for a specific device
 * @remarks
 * Supports multiple devices per user for push notifications.
 * Handles both Expo tokens (for Expo Go) and native FCM/APNs tokens (for production builds).
 */
export interface PushToken {
  /** Push notification token for this device */
  token: string;

  /** Token type: expo (Expo Go), fcm (Android native), or apns (iOS native) */
  type: PushTokenType;

  /** Platform type (iOS or Android) */
  platform: 'ios' | 'android';

  /** Unique device identifier */
  deviceId: string;

  /** App version at time of token generation */
  appVersion: string;

  /** Timestamp when token was created */
  createdAt: Timestamp;

  /** Timestamp when token was last used/verified */
  lastUsed: Timestamp;
}

/**
 * @deprecated Use PushToken instead
 * Legacy type for backward compatibility
 */
export type FCMToken = PushToken;

/**
 * Notification preference categories
 * @remarks
 * Allows granular control over notification types
 */
export interface NotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;

  /** Show message preview in notification */
  showPreview: boolean;

  /** Enable notification sounds */
  sound: boolean;

  /** Enable notification vibration */
  vibration: boolean;

  /** Enable notifications for direct messages */
  directMessages: boolean;

  /** Enable notifications for group messages */
  groupMessages: boolean;

  /** Enable notifications for system messages */
  systemMessages: boolean;

  /** Quiet hours start time (24-hour format, e.g., "22:00") */
  quietHoursStart?: string;

  /** Quiet hours end time (24-hour format, e.g., "08:00") */
  quietHoursEnd?: string;
}

/**
 * Presence privacy and behavior preferences
 * @remarks
 * Controls how user's online/offline status is displayed to others
 */
export interface PresencePreferences {
  /** Whether to show online/offline status to others */
  showOnlineStatus: boolean;

  /** Whether to show "last seen" timestamp when offline */
  showLastSeen: boolean;

  /** Idle timeout in minutes before marked as "away" (default: 5) */
  awayTimeoutMinutes: number;

  /** Whether away detection is enabled */
  awayDetectionEnabled: boolean;

  /** Invisible mode - appear offline while still receiving updates */
  invisibleMode: boolean;
}

/**
 * User settings and preferences
 * @remarks
 * Additional settings will be added in future epics
 */
export interface UserSettings {
  /** Whether to send read receipts to other users */
  sendReadReceipts: boolean;

  /** Whether push notifications are enabled */
  notificationsEnabled: boolean;

  /** Detailed notification preferences */
  notifications?: NotificationPreferences;

  /** Presence and online status preferences */
  presence?: PresencePreferences;
}

/**
 * Represents a complete user profile in the application
 * @remarks
 * This is the main user document stored in Firestore at /users/{uid}
 * Some fields like fcmToken and presence.lastSeen will be fully utilized in Epic 3
 */
export interface User {
  /** Firebase Auth user ID (same as document ID) */
  uid: string;

  /** Unique username (3-20 chars, lowercase, alphanumeric + underscore) */
  username: string;

  /** User's display name (up to 50 characters) */
  displayName: string;

  /** User's email address from Firebase Auth */
  email: string;

  /** Firebase Storage URL for profile photo (optional) */
  photoURL?: string;

  /** Firebase Cloud Messaging token for push notifications (optional, Epic 3) */
  fcmToken?: string;

  /** Array of push tokens for multiple devices (supports Expo and native tokens) */
  fcmTokens?: PushToken[];

  /** @deprecated Legacy field - use fcmTokens instead */
  pushTokens?: PushToken[];

  /** User's current presence information */
  presence: UserPresence;

  /** User's settings and preferences */
  settings: UserSettings;

  /** Server timestamp when user profile was created */
  createdAt: Timestamp;

  /** Server timestamp when user profile was last updated */
  updatedAt: Timestamp;
}

/**
 * Form data structure for profile creation
 * @remarks
 * Used during username setup after registration
 */
export interface UserProfileFormData {
  /** Username to create (will be validated and lowercased) */
  username: string;

  /** Display name for the user */
  displayName: string;

  /** Optional local URI of profile photo to upload */
  photoUri?: string;
}

/**
 * Form data structure for profile editing
 * @remarks
 * Username is read-only after creation, so not included here
 */
export interface UserProfileEditData {
  /** Updated display name */
  displayName: string;

  /** Optional local URI of new profile photo */
  photoUri?: string;
}

/**
 * Username document stored in /usernames collection
 * @remarks
 * Used to enforce username uniqueness. Document ID is the username itself.
 */
export interface UsernameDocument {
  /** Firebase Auth UID of the user who owns this username */
  uid: string;
}

/**
 * Result of username validation
 */
export interface UsernameValidationResult {
  /** Whether the username format is valid */
  isValid: boolean;

  /** Error message if validation failed */
  error?: string;
}

/**
 * Validates username format according to app rules
 * @param username - The username to validate
 * @returns Validation result with error message if invalid
 * @example
 * ```typescript
 * const result = validateUsername('john_doe');
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateUsername(username: string): UsernameValidationResult {
  const lower = username.toLowerCase();

  if (lower.length < MIN_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
    };
  }

  if (lower.length > MAX_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be ${MAX_USERNAME_LENGTH} characters or less`,
    };
  }

  if (!USERNAME_REGEX.test(lower)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  return { isValid: true };
}

/**
 * Validates display name format
 * @param displayName - The display name to validate
 * @returns Validation result with error message if invalid
 * @example
 * ```typescript
 * const result = validateDisplayName('John Doe');
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateDisplayName(displayName: string): UsernameValidationResult {
  const trimmed = displayName.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Display name is required',
    };
  }

  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      isValid: false,
      error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less`,
    };
  }

  return { isValid: true };
}
