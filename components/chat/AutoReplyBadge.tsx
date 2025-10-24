/**
 * AutoReplyBadge component for indicating auto-replied messages
 *
 * @remarks
 * Displays a small badge with robot icon and "Auto-replied" text for messages
 * that were automatically sent via FAQ auto-response feature.
 *
 * @module components/chat/AutoReplyBadge
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Message } from '@/types/models';

/**
 * Props for the AutoReplyBadge component
 */
export interface AutoReplyBadgeProps {
  /** The message to check for auto-reply metadata */
  message: Message;
}

/**
 * Badge component that displays "Auto-replied" indicator for FAQ auto-responses
 *
 * @component
 *
 * @remarks
 * - Only renders when message.metadata.autoResponseSent is true
 * - Displays robot icon with "Auto-replied" text
 * - Styled as a compact badge with light gray background
 * - Positioned below the message bubble
 *
 * Design:
 * - Background: Light gray (#F0F0F0)
 * - Text color: Medium gray (#8E8E93)
 * - Icon: Robot icon from Ionicons
 * - Size: 10px font, 12px icon
 * - Padding: 8px horizontal, 4px vertical
 * - Border radius: 12px for pill shape
 *
 * @example
 * ```tsx
 * <AutoReplyBadge message={messageData} />
 * ```
 *
 * @param props - Component props
 * @returns AutoReplyBadge component or null if not an auto-reply
 */
export const AutoReplyBadge: FC<AutoReplyBadgeProps> = ({ message }) => {
  // Only show badge for auto-replied messages
  if (!message.metadata?.autoResponseSent) {
    return null;
  }

  return (
    <View style={styles.badge} testID="auto-reply-badge">
      <Ionicons name="flash" size={12} color="#8E8E93" />
      <Text style={styles.text}>Auto-replied</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    marginLeft: 12,
  },
  text: {
    fontSize: 10,
    color: '#8E8E93',
    marginLeft: 4,
    fontWeight: '500',
  },
});
