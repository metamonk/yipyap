/**
 * Utility for preloading icon fonts to ensure they work offline
 * @remarks
 * This addresses the issue where vector icons try to load from Metro bundler
 * in offline mode, causing errors. By preloading fonts at app startup,
 * we ensure icons are cached and available offline.
 */

import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

/**
 * Preloads all icon fonts used in the application
 * @returns Promise that resolves when fonts are loaded
 * @throws {Error} If font loading fails
 * @example
 * ```typescript
 * // In app root component
 * useEffect(() => {
 *   loadFonts().catch(console.error);
 * }, []);
 * ```
 */
export async function loadFonts(): Promise<void> {
  try {
    await Font.loadAsync({
      // Preload Ionicons font (consistent icon set across the app)
      ...Ionicons.font,
    });
  } catch (error) {
    // Log error but don't crash the app
    // Icons may still work if previously cached
    console.warn('Failed to preload icon fonts:', error);
  }
}

import { useState, useEffect } from 'react';

/**
 * Hook to ensure fonts are loaded before rendering
 * @returns Object with loading state
 * @example
 * ```typescript
 * function App() {
 *   const { fontsLoaded } = useFontsLoaded();
 *   if (!fontsLoaded) {
 *     return <SplashScreen />;
 *   }
 *   return <MainApp />;
 * }
 * ```
 */
export function useFontsLoaded(): { fontsLoaded: boolean } {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts()
      .then(() => setFontsLoaded(true))
      .catch((error) => {
        console.warn('Font loading failed:', error);
        // Set as loaded anyway to prevent app from hanging
        setFontsLoaded(true);
      });
  }, []);

  return { fontsLoaded };
}
