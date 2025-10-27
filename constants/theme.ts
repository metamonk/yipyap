/**
 * Theme system with light/dark mode support
 *
 * @remarks
 * - Base tokens (spacing, typography, etc.) are shared across themes
 * - Color palettes are defined separately for light and dark modes
 * - Use the `useTheme` hook from ThemeContext to access current theme
 *
 * @example
 * ```tsx
 * import { useTheme } from '@/contexts/ThemeContext';
 *
 * const MyComponent = () => {
 *   const { theme } = useTheme();
 *
 *   return (
 *     <View style={{ backgroundColor: theme.colors.background }}>
 *       <Text style={{ color: theme.colors.textPrimary }}>Hello</Text>
 *     </View>
 *   );
 * };
 * ```
 */

// Base design tokens (same for all themes)
// Inspired by Robinhood's premium aesthetic
const baseTheme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64, // More generous spacing for Robinhood feel
  },

  typography: {
    // Using SF Pro Display (iOS system font) - Robinhood's choice
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 11,    // Smaller captions
      sm: 13,    // Secondary text
      base: 15,  // Body text (Robinhood uses 15, not 16)
      md: 17,    // Emphasized body
      lg: 19,    // Subheadings
      xl: 22,    // Headings
      '2xl': 28, // Large headings
      '3xl': 34, // Screen titles
      '4xl': 40, // Display text
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.3,
      normal: 1.4,   // Robinhood prefers tighter leading
      relaxed: 1.6,
    },
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const, // For impact
    },
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
    },
  },

  borderRadius: {
    none: 0,
    sm: 4,      // Tight corners
    md: 8,      // Standard cards
    lg: 12,     // Large cards
    xl: 16,     // Modals
    '2xl': 20,  // Screen corners
    full: 9999, // Pills/circles
  },

  // Robinhood-style shadows (subtle, refined)
  shadows: {
    none: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  animation: {
    duration: {
      instant: 100,
      fast: 200,
      normal: 300,
      slow: 400,
      slower: 600,
    },
    // Robinhood uses subtle spring animations
    spring: {
      damping: 15,
      stiffness: 150,
    },
  },
} as const;

/**
 * Light theme color palette
 * Clean, minimal, high contrast design
 */
const lightColors = {
  // Brand - Success/primary green
  primary: '#00C805',      // Primary green
  primaryDark: '#00A004',  // Darker green for pressed states
  primaryLight: '#E8F5E9', // Very light green background

  // Semantic (Robinhood-style)
  success: '#00C805',      // Same as primary
  warning: '#FF9500',      // iOS orange
  error: '#FF3B30',        // iOS red
  info: '#007AFF',         // iOS blue

  // Message bubbles - cleaner, more contrast
  messageSent: '#00C805',       // Green for sent
  messageSentText: '#FFFFFF',
  messageReceived: '#F5F5F5',   // Subtle gray (Robinhood uses very light grays)
  messageReceivedText: '#000000', // True black for contrast

  // Backgrounds - pure whites
  background: '#FFFFFF',
  backgroundSecondary: '#FAFAFA', // Barely-there gray
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',     // For cards (same as surface in light mode)
  overlay: 'rgba(0, 0, 0, 0.4)',

  // Borders - very subtle
  border: '#E8E8E8',         // Lighter borders
  borderLight: '#F5F5F5',
  divider: '#EBEBEB',        // Robinhood uses ultra-subtle dividers

  // Text - high contrast
  textPrimary: '#000000',    // True black (Robinhood uses true black)
  textSecondary: '#6B6B6B',  // Medium gray
  textTertiary: '#A0A0A0',   // Light gray
  textInverse: '#FFFFFF',
  textDisabled: '#D0D0D0',

  // Grays - refined palette
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EBEBEB',
  gray300: '#D6D6D6',
  gray400: '#A0A0A0',
  gray500: '#6B6B6B',
  gray600: '#4A4A4A',
  gray700: '#2E2E2E',
  gray800: '#1A1A1A',
  gray900: '#000000',

  // Special accent colors
  accent: '#0EA5E9',         // Cyan accent
  accentSubtle: '#F0F9FF',   // Very light cyan
} as const;

/**
 * Dark theme color palette
 * True black OLED, high contrast, refined
 */
const darkColors = {
  // Brand - Success/primary green (brighter for dark mode)
  primary: '#00D906',      // Brighter green for visibility
  primaryDark: '#00B805',
  primaryLight: '#1A3A1F', // Dark green tint

  // Semantic (adjusted for dark mode visibility)
  success: '#00D906',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#0A84FF',

  // Message bubbles - Robinhood uses true black + subtle grays
  messageSent: '#00D906',
  messageSentText: '#000000',      // Black text on green
  messageReceived: '#1C1C1E',      // Very dark gray (not pure black)
  messageReceivedText: '#FFFFFF',

  // Backgrounds - TRUE BLACK (Robinhood signature)
  background: '#000000',           // Pure black OLED
  backgroundSecondary: '#0D0D0D',  // Barely lighter
  surface: '#1C1C1E',              // Elevated surface
  surfaceElevated: '#2C2C2E',      // Cards/modals
  overlay: 'rgba(0, 0, 0, 0.8)',

  // Borders - very subtle on black
  border: '#2C2C2E',
  borderLight: '#1C1C1E',
  divider: '#252525',

  // Text - high contrast on black
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B6B6B',
  textInverse: '#000000',
  textDisabled: '#4A4A4A',

  // Grays - optimized for OLED
  gray50: '#0D0D0D',
  gray100: '#1C1C1E',
  gray200: '#2C2C2E',
  gray300: '#3A3A3C',
  gray400: '#4A4A4A',
  gray500: '#6B6B6B',
  gray600: '#8E8E93',
  gray700: '#A0A0A0',
  gray800: '#C7C7CC',
  gray900: '#E5E5EA',

  // Special accent colors for dark mode
  accent: '#22B8F5',         // Brighter cyan for visibility
  accentSubtle: '#0C2D3E',   // Dark cyan tint
} as const;

/**
 * Complete light theme
 */
export const lightTheme = {
  ...baseTheme,
  colors: lightColors,
};

/**
 * Complete dark theme
 */
export const darkTheme = {
  ...baseTheme,
  colors: darkColors,
};

/**
 * Theme type for TypeScript autocomplete
 * Uses the structure but allows different color values
 */
export type Theme = {
  spacing: typeof baseTheme.spacing;
  typography: typeof baseTheme.typography;
  borderRadius: typeof baseTheme.borderRadius;
  shadows: typeof baseTheme.shadows;
  animation: typeof baseTheme.animation;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    messageSent: string;
    messageSentText: string;
    messageReceived: string;
    messageReceivedText: string;
    background: string;
    backgroundSecondary: string;
    surface: string;
    surfaceElevated: string;
    overlay: string;
    border: string;
    borderLight: string;
    divider: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    textDisabled: string;
    gray50: string;
    gray100: string;
    gray200: string;
    gray300: string;
    gray400: string;
    gray500: string;
    gray600: string;
    gray700: string;
    gray800: string;
    gray900: string;
    accent: string;
    accentSubtle: string;
  };
};

/**
 * Color palette type
 */
export type Colors = Theme['colors'];

/**
 * Theme mode options
 */
export type ThemeMode = 'light' | 'dark' | 'auto';
