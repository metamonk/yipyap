/**
 * MessageStatus component for displaying message delivery status
 *
 * @remarks
 * Displays appropriate status icons based on message delivery state:
 * - sending: Clock icon
 * - delivered: Double gray checkmark
 * - read: Double blue checkmark (Phase 2)
 * - failed: Red exclamation with retry button
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Props for the MessageStatus component
 */
export interface MessageStatusProps {
  /** Current message delivery status */
  status: 'sending' | 'delivered' | 'read' | 'failed';

  /** Callback when retry button tapped (for failed messages) */
  onRetry?: () => void;

  /** Whether this is a group conversation (shows read count for groups) */
  isGroupChat?: boolean;

  /** Number of participants who have read the message (for group chats) */
  readByCount?: number;

  /** Callback when read receipt is tapped (for group chats) */
  onReadReceiptPress?: () => void;
}

/**
 * Displays message delivery status with appropriate icon
 *
 * @component
 *
 * @remarks
 * - Only displays for messages sent by the current user
 * - Position below message text, right-aligned
 * - Failed status includes retry button
 * - For group chats, shows read count: "Read by 5" instead of just checkmarks
 * - For group chats with no reads, shows "Delivered" text
 *
 * @example
 * ```tsx
 * // 1:1 chat
 * <MessageStatus status="sending" />
 * <MessageStatus status="read" />
 * <MessageStatus status="failed" onRetry={handleRetry} />
 *
 * // Group chat
 * <MessageStatus status="delivered" isGroupChat={true} readByCount={0} />
 * <MessageStatus status="read" isGroupChat={true} readByCount={5} />
 * ```
 */
export const MessageStatus: FC<MessageStatusProps> = ({
  status,
  onRetry,
  isGroupChat = false,
  readByCount = 0,
  onReadReceiptPress,
}) => {
  if (status === 'sending') {
    return (
      <View style={styles.container} testID="status-sending">
        <Ionicons name="time-outline" size={14} color="#8E8E93" />
      </View>
    );
  }

  if (status === 'delivered') {
    return (
      <View style={styles.container} testID="status-delivered">
        <View style={styles.statusRow}>
          {isGroupChat && <Text style={styles.statusText}>Delivered</Text>}
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark" size={14} color="#8E8E93" />
            <Ionicons name="checkmark" size={14} color="#8E8E93" style={styles.doubleCheck} />
          </View>
        </View>
      </View>
    );
  }

  if (status === 'read') {
    // Blue double checkmark for read status
    // For group chats, show read count (tappable to open detail modal)
    return (
      <View style={styles.container} testID="status-read">
        <TouchableOpacity
          style={styles.statusRow}
          onPress={isGroupChat && onReadReceiptPress ? onReadReceiptPress : undefined}
          disabled={!isGroupChat || !onReadReceiptPress}
          activeOpacity={isGroupChat && onReadReceiptPress ? 0.7 : 1}
        >
          {isGroupChat && <Text style={styles.readCountText}>Read by {readByCount}</Text>}
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark" size={14} color="#007AFF" />
            <Ionicons name="checkmark" size={14} color="#007AFF" style={styles.doubleCheck} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.container} testID="status-failed">
        <View style={styles.failedContainer}>
          <Ionicons name="alert-circle" size={14} color="#FF3B30" />
          {onRetry && (
            <TouchableOpacity onPress={onRetry} style={styles.retryButton} testID="retry-button">
              <Ionicons name="refresh" size={14} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  readCountText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
  },
  checkmarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doubleCheck: {
    marginLeft: -8, // Overlap for double checkmark effect
  },
  failedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButton: {
    marginLeft: 8,
    padding: 4,
  },
});
