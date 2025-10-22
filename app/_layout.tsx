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

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { initializeFirebase } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePresence } from '@/hooks/usePresence';
import { useNotifications } from '@/hooks/useNotifications';
import { useGlobalMessageListener } from '@/hooks/useGlobalMessageListener';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { NotificationBanner } from '@/components/common/NotificationBanner';
import { loadFonts } from '@/utils/loadFonts';

// Initialize Firebase synchronously before the app renders
// This ensures Firebase is ready before any component tries to use it
try {
  initializeFirebase();
} catch (error) {
  console.error('Firebase initialization error:', error);
}

/**
 * Root layout component that sets up navigation with auth protection
 */
export default function RootLayout() {
  const { isAuthenticated, hasProfile, isLoading } = useAuth();
  const { connectionStatus } = useNetworkStatus();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Initialize presence tracking for authenticated users
  usePresence();

  // Initialize notifications
  const { lastNotification, clearLastNotification } = useNotifications();

  // Initialize global message listener for notification triggering
  useGlobalMessageListener();

  // Preload icon fonts for offline support
  useEffect(() => {
    loadFonts()
      .then(() => setFontsLoaded(true))
      .catch((error) => {
        console.warn('Font loading failed:', error);
        // Continue anyway to prevent app from hanging
        setFontsLoaded(true);
      });
  }, []);

  // Implement protected route pattern
  // Redirects based on authentication state, profile status, and current route
  useEffect(() => {
    // Don't redirect while still checking auth state
    if (isLoading) return;

    // Check if user is in the auth group (login, register, forgot-password, username-setup)
    const inAuthGroup = segments[0] === '(auth)';
    const onUsernameSetup = (segments as string[])[1] === 'username-setup';

    if (!isAuthenticated && !inAuthGroup) {
      // User is not authenticated and trying to access protected routes
      // Redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !hasProfile && !onUsernameSetup) {
      // User is authenticated but has no profile and not on username setup
      // Redirect to username setup
      router.replace('/(auth)/username-setup');
    } else if (isAuthenticated && hasProfile && inAuthGroup && !onUsernameSetup) {
      // User is authenticated with profile but still on auth screens (not username setup)
      // Redirect to main app
      router.replace('/(tabs)');
    } else if (isAuthenticated && hasProfile && onUsernameSetup) {
      // User is authenticated with profile but on username setup
      // Redirect to main app (profile already exists)
      router.replace('/(tabs)');
    } else if (isAuthenticated && hasProfile && !inAuthGroup && segments.length < 1) {
      // User is authenticated with profile but on root index route
      // Redirect to main app
      router.replace('/(tabs)');
    }

    // Mark navigation as complete after navigation guard logic runs
    // This prevents screen flash by only rendering content after redirect decision is made
    setIsNavigating(false);
  }, [isAuthenticated, hasProfile, isLoading, segments, router]);

  // Show loading screen while checking authentication state, navigating, or loading fonts
  // This prevents screen flash by not rendering routes until navigation guard completes
  // and ensures fonts are loaded before any icons try to render
  if (isLoading || isNavigating || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <>
      <OfflineBanner isOffline={connectionStatus === 'offline'} />
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
