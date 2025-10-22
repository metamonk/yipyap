/**
 * MessageItem component for displaying individual chat messages
 *
 * @remarks
 * Displays a single message in the chat view with appropriate styling based on sender.
 * Sent messages appear right-aligned with blue background, received messages
 * appear left-aligned with gray background and include sender info.
 */

import React, { FC, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { MessageStatus } from '@/components/chat/MessageStatus';
import { formatMessageTime } from '@/utils/dateHelpers';
import type { Message } from '@/types/models';

/**
 * Props for the MessageItem component
 */
export interface MessageItemProps {
  /** The message data to display */
  message: Message;

  /** Whether this message was sent by the current user */
  isOwnMessage: boolean;

  /** Display name of the message sender */
  senderDisplayName: string;

  /** Profile photo URL of the message sender (null if no photo) */
  senderPhotoURL: string | null;

  /** Callback when retry button is tapped (for failed messages) */
  onRetry?: () => void;
}

/**
 * Displays a single message within a chat conversation
 *
 * @component
 *
 * @remarks
 * - Sent messages: Right-aligned, blue background, white text
 * - Received messages: Left-aligned, gray background, black text, includes avatar and sender name
 * - All messages display timestamp below the message text
 * - Uses memo() for performance optimization in FlatList
 *
 * @example
 * ```tsx
 * <MessageItem
 *   message={messageData}
 *   isOwnMessage={true}
 *   senderDisplayName="John Doe"
 *   senderPhotoURL="https://example.com/photo.jpg"
 * />
 * ```
 */
export const MessageItem: FC<MessageItemProps> = memo(
  ({ message, isOwnMessage, senderDisplayName, senderPhotoURL, onRetry }) => {
    return (
      <View
        style={[styles.container, isOwnMessage ? styles.sentMessage : styles.receivedMessage]}
        testID="message-container"
      >
        {/* Avatar for received messages */}
        {!isOwnMessage && (
          <View style={styles.avatarContainer}>
            <Avatar photoURL={senderPhotoURL} displayName={senderDisplayName} size={32} />
          </View>
        )}

        {/* Message content */}
        <View style={styles.messageContent}>
          {/* Sender name for received messages */}
          {!isOwnMessage && <Text style={styles.senderName}>{senderDisplayName}</Text>}

          {/* Message bubble */}
          <View style={[styles.bubble, isOwnMessage ? styles.sentBubble : styles.receivedBubble]}>
            <Text
              style={[styles.messageText, isOwnMessage ? styles.sentText : styles.receivedText]}
            >
              {message.text}
            </Text>
          </View>

          {/* Timestamp and status (for sent messages only) */}
          <View style={styles.metadataContainer}>
            <Text style={styles.timestamp}>{formatMessageTime(message.timestamp)}</Text>

            {/* Message status indicator (only for sent messages) */}
            {isOwnMessage && <MessageStatus status={message.status} onRetry={onRetry} />}
          </View>
        </View>

        {/* Spacer for sent messages to push content right */}
        {isOwnMessage && <View style={styles.spacer} />}
      </View>
    );
  }
);

// Display name for React DevTools
MessageItem.displayName = 'MessageItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    width: '100%',
  },
  sentMessage: {
    justifyContent: 'flex-end',
  },
  receivedMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageContent: {
    maxWidth: '70%',
  },
  senderName: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
    marginLeft: 12,
    fontWeight: '600',
  },
  bubble: {
    borderRadius: 18,
    padding: 12,
  },
  sentBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#000000',
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginLeft: 12,
  },
  timestamp: {
    fontSize: 11,
    color: '#8E8E93',
  },
  spacer: {
    width: 40, // Space for avatar on the other side (for alignment)
  },
});
