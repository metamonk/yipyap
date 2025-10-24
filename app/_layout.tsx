/**
 * Root layout component for the app with protected route pattern
 * @component
 * @remarks
 * This is the entry point for the Expo Router navigation structure
 * Initializes Firebase and implements authentication-based routing
 * - Shows loading screen while checking auth state
 * - Redirects unauthenticated users to login
 * - Redirects authenticated users away from auth screens
 * - Protects (tabs) routes from unauthorized access
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeFirebase } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useConnectionState } from '@/hooks/useConnectionState';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePresence } from '@/hooks/usePresence';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { NotificationBanner } from '@/components/common/NotificationBanner';

// Initialize Firebase before React renders
// This is safe because initializeFirebase checks if it's already initialized

initializeFirebase();

/**
 * Root layout component that sets up navigation with auth protection
 * @remarks
 * Implements reactive auth-based routing:
 * - Responds to auth state changes automatically (logout, login, profile creation)
 * - Protects tab routes from unauthenticated access
 * - Redirects authenticated users away from auth screens
 * - Prevents infinite loops by only navigating when necessary
 */
export default function RootLayout() {
  const { isAuthenticated, hasProfile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { connected } = useConnectionState();
  const { lastNotification, clearLastNotification } = useNotifications();
  useNotificationPermissions();
  useOfflineSync();
  usePresence();

  /**
   * Reactive routing based on auth state changes
   * @remarks
   * This effect handles navigation when auth state changes:
   * - Logout: Redirects from (tabs) to login
   * - Login without profile: Redirects to username-setup
   * - Login with profile on auth screen: Redirects to app
   * - Initial load: Handled by app/index.tsx
   */
  useEffect(() => {
    // Don't navigate while checking auth state
    if (isLoading) return;

    // Skip if on index route (initial load handled by app/index.tsx)
    if (!segments || segments.length === 0) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const onUsernameSetup = segments.length > 1 && segments[1] === 'username-setup';

    // Redirect logic based on auth state and current location
    if (!isAuthenticated && inTabsGroup) {
      // User logged out while in protected area → redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !hasProfile && !onUsernameSetup) {
      // User authenticated but no profile → redirect to setup (unless already there)
      router.replace('/(auth)/username-setup');
    } else if (isAuthenticated && hasProfile && inAuthGroup) {
      // User authenticated with profile on auth screen → redirect to app
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, hasProfile, isLoading, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OfflineBanner isOffline={!connected} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <NotificationBanner
        notification={lastNotification}
        onPress={() => {
          // Navigation handled by notification hook
          clearLastNotification();
        }}
        onClose={clearLastNotification}
      />
    </GestureHandlerRootView>
  );
}
