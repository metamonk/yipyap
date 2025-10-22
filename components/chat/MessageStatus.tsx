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
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Props for the MessageStatus component
 */
export interface MessageStatusProps {
  /** Current message delivery status */
  status: 'sending' | 'delivered' | 'read' | 'failed';

  /** Callback when retry button tapped (for failed messages) */
  onRetry?: () => void;
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
 *
 * @example
 * ```tsx
 * <MessageStatus status="sending" />
 * <MessageStatus status="failed" onRetry={handleRetry} />
 * ```
 */
export const MessageStatus: FC<MessageStatusProps> = ({ status, onRetry }) => {
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
        <View style={styles.checkmarkContainer}>
          <Ionicons name="checkmark" size={14} color="#8E8E93" />
          <Ionicons name="checkmark" size={14} color="#8E8E93" style={styles.doubleCheck} />
        </View>
      </View>
    );
  }

  if (status === 'read') {
    // Phase 2 feature - blue double checkmark
    return (
      <View style={styles.container} testID="status-read">
        <View style={styles.checkmarkContainer}>
          <Ionicons name="checkmark" size={14} color="#007AFF" />
          <Ionicons name="checkmark" size={14} color="#007AFF" style={styles.doubleCheck} />
        </View>
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
