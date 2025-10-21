/**
 * Root layout component for the app
 * @component
 * @remarks
 * This is the entry point for the Expo Router navigation structure
 * Initializes Firebase and sets up the navigation hierarchy
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { initializeFirebase } from '@/services/firebase';

/**
 * Root layout component that initializes Firebase and sets up navigation
 */
export default function RootLayout() {
  useEffect(() => {
    try {
      initializeFirebase();
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
