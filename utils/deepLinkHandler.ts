/**
 * Deep Link Handler for Push Notifications
 * @module utils/deepLinkHandler
 *
 * @remarks
 * Handles navigation from push notification taps to specific conversations.
 * Manages app state transitions and queued navigation.
 */

import * as Linking from 'expo-linking';
import type { NotificationData } from '@/services/notificationService';

/**
 * Navigation queue for pending deep link navigation
 * Used when app is not ready to navigate yet
 */
const navigationQueue: Array<() => void> = [];
let isNavigationReady = false;

/**
 * Navigation callback function type
 */
export type NavigationCallback = (conversationId: string, messageId?: string) => void;

/**
 * Current registered navigation callback
 */
let navigationCallback: NavigationCallback | null = null;

/**
 * Deep link configuration for Expo
 * This should be added to app.json under expo.scheme
 */
export const DEEP_LINK_SCHEME = 'yipyap';

/**
 * Deep link prefix configuration
 */
export const DEEP_LINK_PREFIX = `${DEEP_LINK_SCHEME}://`;

/**
 * Registers a navigation callback to handle deep links
 *
 * @param callback - Function to call when navigating to a conversation
 *
 * @example
 * ```typescript
 * // In your root navigator
 * registerNavigationCallback((conversationId, messageId) => {
 *   navigation.navigate('Chat', { conversationId, messageId });
 * });
 * ```
 */
export function registerNavigationCallback(callback: NavigationCallback): void {
  navigationCallback = callback;
  setNavigationReady(true);

  // Process any queued navigation
  flushNavigationQueue();
}

/**
 * Unregisters the navigation callback
 */
export function unregisterNavigationCallback(): void {
  navigationCallback = null;
  setNavigationReady(false);
}

/**
 * Sets whether navigation is ready
 * @param ready - True if navigation system is ready
 */
export function setNavigationReady(ready: boolean): void {
  isNavigationReady = ready;

  if (ready) {
    flushNavigationQueue();
  }
}

/**
 * Handles notification tap and navigates to the appropriate screen
 *
 * @param notificationData - Data from the notification
 * @returns True if navigation was handled, false otherwise
 *
 * @example
 * ```typescript
 * // In your notification response listener
 * const data = response.notification.request.content.data;
 * handleNotificationTap(data as NotificationData);
 * ```
 */
export function handleNotificationTap(notificationData: NotificationData): boolean {
  try {
    const { conversationId, messageId } = notificationData;

    if (!conversationId) {
      console.error('[DeepLinkHandler] Missing conversationId in notification data');
      return false;
    }

    // If navigation is ready, navigate immediately
    if (isNavigationReady && navigationCallback) {
      navigationCallback(conversationId, messageId);
      return true;
    }

    // Otherwise, queue the navigation for when the app is ready
    queueNavigation(conversationId, messageId);
    return true;
  } catch (error) {
    console.error('[DeepLinkHandler] Error handling notification tap:', error);
    return false;
  }
}

/**
 * Queues navigation for later execution
 * @param conversationId - Conversation to navigate to
 * @param messageId - Optional message ID to highlight
 * @private
 */
function queueNavigation(conversationId: string, messageId?: string): void {
  navigationQueue.push(() => {
    if (navigationCallback) {
      navigationCallback(conversationId, messageId);
    }
  });
}

/**
 * Executes all queued navigation actions
 * @private
 */
function flushNavigationQueue(): void {
  if (!isNavigationReady || !navigationCallback) {
    return;
  }

  while (navigationQueue.length > 0) {
    const navigate = navigationQueue.shift();
    if (navigate) {
      navigate();
    }
  }
}

/**
 * Parses a deep link URL into conversation and message IDs
 *
 * @param url - Deep link URL to parse
 * @returns Parsed conversation and message IDs, or null if invalid
 *
 * @example
 * ```typescript
 * const result = parseDeepLink('yipyap://conversation/conv123?messageId=msg456');
 * // Returns: { conversationId: 'conv123', messageId: 'msg456' }
 * ```
 */
export function parseDeepLink(url: string): {
  conversationId: string;
  messageId?: string;
} | null {
  try {
    const parsed = Linking.parse(url);

    if (!parsed.path) {
      return null;
    }

    // Expected format: conversation/{conversationId}?messageId={messageId}
    const pathParts = parsed.path.split('/');

    if (pathParts[0] !== 'conversation' || !pathParts[1]) {
      console.warn('[DeepLinkHandler] Invalid deep link path:', parsed.path);
      return null;
    }

    const conversationId = pathParts[1];
    const messageId = parsed.queryParams?.messageId as string | undefined;

    return {
      conversationId,
      messageId,
    };
  } catch (error) {
    console.error('[DeepLinkHandler] Error parsing deep link:', error);
    return null;
  }
}

/**
 * Generates a deep link URL for a conversation
 *
 * @param conversationId - Conversation ID
 * @param messageId - Optional message ID
 * @returns Deep link URL
 *
 * @example
 * ```typescript
 * const url = generateDeepLink('conv123', 'msg456');
 * // Returns: 'yipyap://conversation/conv123?messageId=msg456'
 * ```
 */
export function generateDeepLink(conversationId: string, messageId?: string): string {
  let url = `${DEEP_LINK_PREFIX}conversation/${conversationId}`;

  if (messageId) {
    url += `?messageId=${messageId}`;
  }

  return url;
}

/**
 * Handles app opening from a deep link URL
 *
 * @param url - Deep link URL
 * @returns True if link was handled, false otherwise
 *
 * @example
 * ```typescript
 * // In your app root
 * useEffect(() => {
 *   Linking.getInitialURL().then((url) => {
 *     if (url) {
 *       handleDeepLink(url);
 *     }
 *   });
 *
 *   const subscription = Linking.addEventListener('url', ({ url }) => {
 *     handleDeepLink(url);
 *   });
 *
 *   return () => subscription.remove();
 * }, []);
 * ```
 */
export function handleDeepLink(url: string): boolean {
  try {
    const parsed = parseDeepLink(url);

    if (!parsed) {
      return false;
    }

    const { conversationId, messageId } = parsed;

    // If navigation is ready, navigate immediately
    if (isNavigationReady && navigationCallback) {
      navigationCallback(conversationId, messageId);
      return true;
    }

    // Otherwise, queue the navigation
    queueNavigation(conversationId, messageId);
    return true;
  } catch (error) {
    console.error('[DeepLinkHandler] Error handling deep link:', error);
    return false;
  }
}

/**
 * Gets the initial deep link URL if app was opened from a notification
 *
 * @returns Promise resolving to the initial URL or null
 *
 * @example
 * ```typescript
 * const initialUrl = await getInitialURL();
 * if (initialUrl) {
 *   handleDeepLink(initialUrl);
 * }
 * ```
 */
export async function getInitialURL(): Promise<string | null> {
  try {
    return await Linking.getInitialURL();
  } catch (error) {
    console.error('[DeepLinkHandler] Error getting initial URL:', error);
    return null;
  }
}

/**
 * Sets up deep link listeners
 *
 * @param onDeepLink - Callback when a deep link is opened
 * @returns Cleanup function to remove listeners
 *
 * @example
 * ```typescript
 * const cleanup = setupDeepLinkListeners((url) => {
 *   console.log('Deep link opened:', url);
 *   handleDeepLink(url);
 * });
 * // Later: cleanup();
 * ```
 */
export function setupDeepLinkListeners(
  onDeepLink: (url: string) => void
): () => void {
  // Handle initial URL (app opened from killed state)
  getInitialURL().then((url) => {
    if (url) {
      onDeepLink(url);
    }
  });

  // Handle URL events (app opened from background)
  const subscription = Linking.addEventListener('url', ({ url }) => {
    onDeepLink(url);
  });

  // Return cleanup function
  return () => {
    subscription.remove();
  };
}
