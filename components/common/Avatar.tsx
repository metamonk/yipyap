/**
 * Avatar component for displaying user profile photos
 *
 * @remarks
 * Displays a user's profile photo with a fallback to initials when no photo is available.
 * Supports customizable size with circular styling.
 */

import React, { FC } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

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
 * Avatar component that displays a user's profile photo or initials
 *
 * @component
 *
 * @remarks
 * - Displays profile photo if photoURL is provided
 * - Displays first letter of displayName as fallback when no photo
 * - Circular border with customizable size
 * - Background color for initials fallback
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
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // Get first letter of display name for fallback
  const initials = displayName.charAt(0).toUpperCase();

  const fontSize = size * 0.4; // Font size scales with avatar size

  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.avatar, containerStyle]}
        testID="avatar-image"
      />
    );
  }

  // Fallback to initials
  return (
    <View style={[styles.fallback, containerStyle]} testID="avatar-fallback">
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#E5E5E5',
  },
  fallback: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
