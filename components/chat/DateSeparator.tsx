/**
 * Date separator component for chat timeline
 *
 * @remarks
 * Displays a centered date label with horizontal lines to visually separate
 * messages from different days in the chat conversation.
 */

import React, { FC, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDateSeparator } from '@/utils/dateHelpers';
import type { Timestamp } from 'firebase/firestore';

/**
 * Props for the DateSeparator component
 */
export interface DateSeparatorProps {
  /** Firestore timestamp for the date to display */
  timestamp: Timestamp;
}

/**
 * Displays a date separator between messages from different days
 *
 * @component
 *
 * @remarks
 * Shows a formatted date label centered in the chat view with horizontal lines
 * on both sides. Used to visually group messages by date in the chat timeline.
 *
 * Uses subtle styling (gray text, small font) to provide context without
 * distracting from message content.
 *
 * @example
 * ```tsx
 * <DateSeparator timestamp={message.timestamp} />
 * // Displays: "─── Today ───"
 * ```
 */
export const DateSeparator: FC<DateSeparatorProps> = memo(({ timestamp }) => {
  return (
    <View style={styles.container} testID="date-separator">
      <View style={styles.line} />
      <Text style={styles.dateText}>{formatDateSeparator(timestamp)}</Text>
      <View style={styles.line} />
    </View>
  );
});

// Display name for React DevTools
DateSeparator.displayName = 'DateSeparator';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D1D6', // Subtle gray line
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93', // iOS gray color
    fontWeight: '600',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
