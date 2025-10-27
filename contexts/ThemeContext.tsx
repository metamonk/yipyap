/**
 * Theme Context Provider
 *
 * @remarks
 * Manages theme state with support for:
 * - Auto mode (follows system preference) - DEFAULT
 * - Light mode (always light)
 * - Dark mode (always dark)
 * - Persists user preference to AsyncStorage
 *
 * @example
 * ```tsx
 * // Wrap your app
 * import { ThemeProvider } from '@/contexts/ThemeContext';
 *
 * export default function RootLayout() {
 *   return (
 *     <ThemeProvider>
 *       <Stack />
 *     </ThemeProvider>
 *   );
 * }
 *
 * // Use in components
 * import { useTheme } from '@/contexts/ThemeContext';
 *
 * const MyComponent = () => {
 *   const { theme, isDark, themeMode, setThemeMode } = useTheme();
 *
 *   return (
 *     <View style={{ backgroundColor: theme.colors.background }}>
 *       <Text style={{ color: theme.colors.textPrimary }}>
 *         Current mode: {themeMode}
 *       </Text>
 *       <Button title="Toggle Dark" onPress={() => setThemeMode('dark')} />
 *     </View>
 *   );
 * };
 * ```
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme, ThemeMode } from '@/constants/theme';

const THEME_STORAGE_KEY = '@yipyap:theme_preference';

/**
 * Theme context value type
 */
interface ThemeContextType {
  /** Current active theme (light or dark) */
  theme: Theme;

  /** User's theme preference (auto, light, or dark) */
  themeMode: ThemeMode;

  /** Set theme mode and persist to storage */
  setThemeMode: (mode: ThemeMode) => void;

  /** Whether dark mode is currently active */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider Component
 *
 * @remarks
 * - Defaults to 'auto' mode (follows system preference)
 * - Loads saved preference from AsyncStorage on mount
 * - Saves preference when changed
 * - Automatically updates when system theme changes (in 'auto' mode)
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme(); // Detects system preference
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'auto' || saved === 'light' || saved === 'dark')) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Determine if dark mode should be active
  const isDark =
    themeMode === 'auto' ? systemColorScheme === 'dark' : themeMode === 'dark';

  // Select the appropriate theme
  const theme = isDark ? darkTheme : lightTheme;

  /**
   * Update theme mode and persist to storage
   *
   * @param mode - 'auto' (system), 'light', or 'dark'
   */
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  // Don't render children until theme preference is loaded
  // This prevents a flash of wrong theme on app launch
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 *
 * @throws Error if used outside ThemeProvider
 *
 * @example
 * ```tsx
 * const { theme, isDark, themeMode, setThemeMode } = useTheme();
 * ```
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
