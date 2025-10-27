/**
 * Avatar component for displaying user profile photos
 *
 * @remarks
 * Displays a user's profile photo with a fallback to initials when no photo is available.
 * Supports customizable size with circular styling.
 * Now uses theme system for light/dark mode support and color variety.
 */

import React, { FC, useMemo } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for the Avatar component
 */
export interface AvatarProps {
  /** URL of the user's profile photo (null if no photo) */
  photoURL: string | null;

  /** User's display name (used for fallback initials) */
  displayName: string;

  /** Size of the avatar in pixels (diameter) */
  size: number;
}

/**
 * Generate a consistent color for a user based on their display name
 * @remarks Uses hash function to ensure same user always gets same color
 */
const getAvatarColor = (displayName: string): string => {
  const colors = [
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#FF3B30', // Red
    '#5AC8FA', // Teal
    '#AF52DE', // Purple
    '#FF2D55', // Pink
    '#5856D6', // Indigo
  ];

  // Hash the display name to get a consistent index
  const hash = displayName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/**
 * Avatar component that displays a user's profile photo or initials
 *
 * @component
 *
 * @remarks
 * - Displays profile photo if photoURL is provided
 * - Displays first letter of displayName as fallback when no photo
 * - Circular border with customizable size
 * - Uses theme system for proper light/dark mode support
 * - Color variety for initials based on user name
 * - Subtle shadow for depth
 *
 * @example
 * ```tsx
 * // With photo
 * <Avatar
 *   photoURL="https://example.com/photo.jpg"
 *   displayName="John Doe"
 *   size={48}
 * />
 *
 * // Without photo (shows initials)
 * <Avatar
 *   photoURL={null}
 *   displayName="Jane Smith"
 *   size={48}
 * />
 * ```
 */
export const Avatar: FC<AvatarProps> = ({ photoURL, displayName, size }) => {
  const { theme } = useTheme();

  const containerStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size]
  );

  // Get first letter of display name for fallback
  const initials = displayName.charAt(0).toUpperCase();

  // Font size scales with avatar size
  const fontSize = size * 0.4;

  // Get consistent color for this user
  const avatarColor = useMemo(() => getAvatarColor(displayName), [displayName]);

  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.avatar, containerStyle, { backgroundColor: theme.colors.gray200 }]}
        testID="avatar-image"
      />
    );
  }

  // Fallback to initials with color variety
  return (
    <View
      style={[
        styles.fallback,
        containerStyle,
        { backgroundColor: avatarColor },
        theme.shadows.sm, // Subtle shadow for depth
      ]}
      testID="avatar-fallback"
    >
      <Text style={[styles.initials, { fontSize, fontWeight: theme.typography.fontWeight.semibold }]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    // backgroundColor set dynamically from theme
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor set dynamically based on user
    // Shadow applied from theme
  },
  initials: {
    color: '#FFFFFF',
    // fontWeight set dynamically from theme
  },
});
