/**
 * Navigation Hook
 * @module hooks/useNavigation
 * @remarks
 * Provides type-safe navigation utilities and common navigation patterns.
 *
 * Benefits:
 * - DRY - Encapsulates repeated navigation logic
 * - Type-safe navigation with autocomplete
 * - Consistent behavior across the app
 * - Easier to test and maintain
 * - Clear navigation conventions
 *
 * @example
 * ```typescript
 * import { useNavigation } from '@/hooks/useNavigation';
 *
 * function MyComponent() {
 *   const { goToConversation, goBackOrFallback } = useNavigation();
 *
 *   // Navigate to conversation
 *   goToConversation(conversationId);
 *
 *   // Navigate back with fallback
 *   goBackOrFallback('/(tabs)/profile');
 * }
 * ```
 */

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { ROUTES, FALLBACK_ROUTES } from '@/constants/routes';
import type { AppRoute } from '@/constants/routes';

/**
 * Navigation utilities hook
 * Provides common navigation patterns used throughout the app
 */
export function useNavigation() {
  const router = useRouter();

  /**
   * Navigate back if possible, otherwise go to fallback route
   * @param fallbackRoute - Route to navigate to if back history is empty
   *
   * @example
   * ```typescript
   * // Go back or return to profile
   * goBackOrFallback(ROUTES.TABS.PROFILE);
   * ```
   */
  const goBackOrFallback = useCallback(
    (fallbackRoute: AppRoute | string = FALLBACK_ROUTES.DEFAULT) => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(fallbackRoute as any);
      }
    },
    [router]
  );

  /**
   * Navigate to a conversation
   * @param conversationId - Conversation ID
   * @param messageId - Optional message ID to scroll to
   *
   * @example
   * ```typescript
   * // Navigate to conversation
   * goToConversation('conv123');
   *
   * // Navigate to conversation and scroll to message
   * goToConversation('conv123', 'msg456');
   * ```
   */
  const goToConversation = useCallback(
    (conversationId: string, messageId?: string) => {
      router.push(ROUTES.CONVERSATIONS.DETAIL(conversationId, messageId) as any);
    },
    [router]
  );

  /**
   * Navigate to a profile settings screen
   * @param settingsRoute - Profile settings route
   *
   * @example
   * ```typescript
   * goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS);
   * ```
   */
  const goToProfileSettings = useCallback(
    (settingsRoute: string) => {
      router.push(settingsRoute as any);
    },
    [router]
  );

  /**
   * Navigate to home/dashboard
   */
  const goToHome = useCallback(() => {
    router.push(ROUTES.TABS.HOME as any);
  }, [router]);

  /**
   * Navigate to daily digest
   */
  const goToDailyDigest = useCallback(() => {
    router.push(ROUTES.TABS.DAILY as any);
  }, [router]);

  /**
   * Navigate to conversations list
   */
  const goToConversations = useCallback(() => {
    router.push(ROUTES.TABS.CONVERSATIONS as any);
  }, [router]);

  /**
   * Navigate to profile
   */
  const goToProfile = useCallback(() => {
    router.push(ROUTES.TABS.PROFILE as any);
  }, [router]);

  /**
   * Navigate with auth check
   * Shows alert if not authenticated and optionally redirects to login
   *
   * @param route - Route to navigate to if authenticated
   * @param isAuthenticated - Whether user is authenticated
   * @param errorMessage - Custom error message
   *
   * @example
   * ```typescript
   * navigateWithAuthCheck(
   *   ROUTES.PROFILE.SETTINGS,
   *   !!currentUser,
   *   'You must be logged in to access settings'
   * );
   * ```
   */
  const navigateWithAuthCheck = useCallback(
    (
      route: string,
      isAuthenticated: boolean,
      errorMessage = 'You must be logged in to access this feature.'
    ) => {
      if (!isAuthenticated) {
        Alert.alert('Authentication Required', errorMessage);
        return false;
      }
      router.push(route as any);
      return true;
    },
    [router]
  );

  /**
   * Replace current route (no back navigation)
   * @param route - Route to navigate to
   *
   * @example
   * ```typescript
   * // After creating conversation, replace so back doesn't go to "new"
   * replaceWith(ROUTES.CONVERSATIONS.DETAIL(newConversationId));
   * ```
   */
  const replaceWith = useCallback(
    (route: string) => {
      router.replace(route as any);
    },
    [router]
  );

  /**
   * Navigate to auth screen (for logout/unauthenticated states)
   */
  const goToAuth = useCallback(() => {
    router.replace(ROUTES.AUTH.LOGIN as any);
  }, [router]);

  /**
   * Navigate to group settings
   * @param conversationId - Conversation ID
   */
  const goToGroupSettings = useCallback(
    (conversationId: string) => {
      router.push(ROUTES.CONVERSATIONS.GROUP_SETTINGS(conversationId) as any);
    },
    [router]
  );

  /**
   * Navigate to group members
   * @param conversationId - Conversation ID
   */
  const goToGroupMembers = useCallback(
    (conversationId: string) => {
      router.push(ROUTES.CONVERSATIONS.GROUP_MEMBERS(conversationId) as any);
    },
    [router]
  );

  return {
    // Core navigation
    router,
    goBackOrFallback,

    // Common destinations
    goToHome,
    goToDailyDigest,
    goToConversations,
    goToProfile,
    goToConversation,
    goToProfileSettings,
    goToGroupSettings,
    goToGroupMembers,

    // Special patterns
    navigateWithAuthCheck,
    replaceWith,
    goToAuth,

    // Route constants (for convenience)
    ROUTES,
  };
}

/**
 * Type for the navigation hook return value
 */
export type NavigationHook = ReturnType<typeof useNavigation>;
