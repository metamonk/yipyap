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

import { StyleSheet } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { initializeFirebase } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useConnectionState } from '@/hooks/useConnectionState';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { NotificationBanner } from '@/components/common/NotificationBanner';

// Initialize Firebase before React renders
// This is safe because initializeFirebase checks if it's already initialized
console.log('[RootLayout] Initializing Firebase...');
initializeFirebase();
console.log('[RootLayout] Firebase initialization complete');

/**
 * Root layout component that sets up navigation with auth protection
 */
export default function RootLayout() {
  console.log('[RootLayout] Component rendering...');
  const { connected } = useConnectionState();
  const { lastNotification, clearLastNotification } = useNotifications();

  useNotificationPermissions();
  useOfflineSync();

  // Note: Navigation is now handled by app/index.tsx
  // This layout just provides the Stack navigator structure

  return (
    <>
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
    </>
  );
}
