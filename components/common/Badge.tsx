/**
 * Badge component for displaying notification counts
 *
 * @remarks
 * Displays a circular badge with a count number, typically used for unread message counts.
 * Only renders when count is greater than 0.
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Props for the Badge component
 */
export interface BadgeProps {
  /** Number to display in the badge */
  count: number;

  /** Visual variant of the badge */
  variant: 'primary' | 'danger';
}

/**
 * Badge component that displays a count with a colored background
 *
 * @component
 *
 * @remarks
 * - Only renders when count > 0
 * - Circular background with white text
 * - Supports 'primary' (blue) and 'danger' (red) variants
 * - Automatically sizes based on count digits
 *
 * @example
 * ```tsx
 * // Display unread count
 * <Badge count={5} variant="primary" />
 *
 * // Display notification count
 * <Badge count={12} variant="danger" />
 *
 * // Badge won't render when count is 0
 * <Badge count={0} variant="primary" />
 * ```
 */
export const Badge: FC<BadgeProps> = ({ count, variant }) => {
  // Don't render if count is 0
  if (count <= 0) {
    return null;
  }

  const backgroundColor = variant === 'primary' ? '#007AFF' : '#FF3B30';

  return (
    <View style={[styles.badge, { backgroundColor }]} testID="badge">
      <Text style={styles.count} testID="badge-count">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  count: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
