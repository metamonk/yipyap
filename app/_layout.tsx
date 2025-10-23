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

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeFirebase } from '@/services/firebase';
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
 */
export default function RootLayout() {
  const { connected } = useConnectionState();
  const { lastNotification, clearLastNotification } = useNotifications();
  useNotificationPermissions();
  useOfflineSync();
  usePresence();

  // Note: Navigation is now handled by app/index.tsx
  // This layout just provides the Stack navigator structure

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
