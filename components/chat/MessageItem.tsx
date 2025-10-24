/**
 * MessageItem component for displaying individual chat messages
 *
 * @remarks
 * Displays a single message in the chat view with appropriate styling based on sender.
 * Sent messages appear right-aligned with blue background, received messages
 * appear left-aligned with gray background and include sender info.
 */

import React, { FC, memo, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { MessageStatus } from '@/components/chat/MessageStatus';
import { ReadReceiptModal } from '@/components/chat/ReadReceiptModal';
import { AutoReplyBadge } from '@/components/chat/AutoReplyBadge';
import { SuggestedFAQButton } from '@/components/chat/SuggestedFAQButton';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { formatMessageTime } from '@/utils/dateHelpers';
import { sendSuggestedFAQ } from '@/services/faqService';
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

  /** Whether this is a group conversation (determines if sender attribution is always shown) */
  isGroupChat?: boolean;

  /** Array of participant IDs in the conversation (for read receipt modal in groups) */
  participantIds?: string[];

  /** Callback when retry button is tapped (for failed messages) */
  onRetry?: () => void;

  /** Whether this message's read receipt is being retried */
  isRetrying?: boolean;
}

/**
 * Helper function to determine sentiment tint color based on score
 * @param score - Sentiment score from -1 (very negative) to 1 (very positive)
 * @returns RGBA color string for background tint
 */
const getSentimentTint = (score: number | undefined): string => {
  if (score === undefined) return 'transparent';

  if (score <= -0.7) return 'rgba(255, 59, 48, 0.08)'; // Strong negative - red
  if (score <= -0.3) return 'rgba(255, 149, 0, 0.05)'; // Moderate negative - orange
  if (score >= 0.7) return 'rgba(52, 199, 89, 0.08)'; // Strong positive - green
  if (score >= 0.3) return 'rgba(52, 199, 89, 0.05)'; // Moderate positive - light green

  return 'transparent'; // Neutral (-0.29 to 0.29)
};

/**
 * Displays a single message within a chat conversation
 *
 * @component
 *
 * @remarks
 * - Sent messages: Right-aligned, blue background, white text
 * - Received messages: Left-aligned, gray background, black text, includes avatar and sender name
 * - Group messages: ALWAYS show sender name and avatar for attribution (AC: 2, 5)
 * - 1:1 messages: Only show sender info for received messages
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
 *   isGroupChat={true}
 * />
 * ```
 */
export const MessageItem: FC<MessageItemProps> = memo(
  ({
    message,
    isOwnMessage,
    senderDisplayName,
    senderPhotoURL,
    isGroupChat = false,
    participantIds = [],
    onRetry,
    isRetrying = false,
  }) => {
    // State for read receipt modal
    const [showReadReceiptModal, setShowReadReceiptModal] = useState(false);

    // Animation for retry indication
    const opacityAnim = useMemo(() => new Animated.Value(1), []);

    // Determine if sender attribution should be shown
    // For group chats: Show sender name and avatar for OTHER users only (not own messages)
    // For 1:1 chats: Only show for received messages
    // Own messages NEVER show avatar to avoid redundancy
    const showSenderInfo = !isOwnMessage;
    const showAvatar = !isOwnMessage;

    // Handler to open read receipt modal
    const handleReadReceiptPress = () => {
      if (isGroupChat && participantIds.length > 0) {
        setShowReadReceiptModal(true);
      }
    };

    // Handler to send suggested FAQ response
    const handleSendSuggestedFAQ = async (templateId: string, answer: string) => {
      await sendSuggestedFAQ(message, templateId, answer);
      // Success feedback is shown by the service layer via message update
    };

    useEffect(() => {
      if (isRetrying) {
        // Start pulsing animation when retrying
        const animation = Animated.loop(
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.7,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
        animation.start();

        // Cleanup animation when component unmounts or retry stops
        return () => {
          animation.stop();
          opacityAnim.setValue(1);
        };
      } else {
        // Reset opacity when not retrying
        opacityAnim.setValue(1);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- opacityAnim is stable (created via useMemo)
    }, [isRetrying]);

    return (
      <Animated.View
        style={[
          styles.container,
          isOwnMessage ? styles.sentMessage : styles.receivedMessage,
          { opacity: opacityAnim },
        ]}
        testID="message-container"
        accessibilityLabel={isRetrying ? 'Message syncing' : undefined}
        accessibilityHint={isRetrying ? 'This message is being synchronized' : undefined}
      >
        {/* Avatar - shown for all messages in group, only received in 1:1 */}
        {showAvatar && (
          <View style={styles.avatarContainer}>
            <Avatar photoURL={senderPhotoURL} displayName={senderDisplayName} size={32} />
            {/* Show presence indicator only in group chats for better context */}
            {isGroupChat && (
              <View style={styles.avatarPresenceIndicator}>
                <PresenceIndicator userId={message.senderId} size="small" hideWhenOffline={true} />
              </View>
            )}
          </View>
        )}

        {/* Message content */}
        <View style={styles.messageContent}>
          {/* Sender name - shown for received messages, hidden for own messages */}
          {showSenderInfo && <Text style={styles.senderName}>{senderDisplayName}</Text>}

          {/* Message bubble with sentiment tint overlay */}
          <View style={[styles.bubble, isOwnMessage ? styles.sentBubble : styles.receivedBubble]}>
            {/* Sentiment tint overlay */}
            {message.metadata?.sentimentScore !== undefined && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.bubble,
                  isOwnMessage
                    ? { borderBottomRightRadius: 4 }
                    : { borderBottomLeftRadius: 4 },
                  { backgroundColor: getSentimentTint(message.metadata.sentimentScore) },
                ]}
              />
            )}
            <Text
              style={[styles.messageText, isOwnMessage ? styles.sentText : styles.receivedText]}
            >
              {message.text}
            </Text>
          </View>

          {/* Timestamp, status, and sync indicator */}
          <View style={styles.metadataContainer}>
            <View style={styles.timestampRow}>
              <Text style={styles.timestamp}>{formatMessageTime(message.timestamp)}</Text>

              {/* Syncing indicator */}
              {isRetrying && (
                <Text style={styles.syncingText} accessibilityLiveRegion="polite">
                  {' • syncing'}
                </Text>
              )}
            </View>

            {/* Message status indicator (only for sent messages) */}
            {isOwnMessage && (
              <MessageStatus
                status={message.status}
                onRetry={onRetry}
                isGroupChat={isGroupChat}
                readByCount={message.readBy?.length || 0}
                onReadReceiptPress={handleReadReceiptPress}
              />
            )}
          </View>

          {/* Auto-Reply Badge (Story 5.4) - shown for FAQ auto-responses */}
          <AutoReplyBadge message={message} />

          {/* Suggested FAQ Button (Story 5.4 - Task 11) - shown for medium-confidence FAQ suggestions */}
          {!isOwnMessage && <SuggestedFAQButton message={message} onSend={handleSendSuggestedFAQ} />}
        </View>

        {/* No spacer needed - own messages go to edge without gap */}

        {/* Read receipt detail modal (for group chats) */}
        {isGroupChat && (
          <ReadReceiptModal
            visible={showReadReceiptModal}
            onClose={() => setShowReadReceiptModal(false)}
            message={message}
            participantIds={participantIds}
          />
        )}
      </Animated.View>
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
    position: 'relative',
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatarPresenceIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
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
    backgroundColor: '#007AFF', // Blue accent for own messages (AC: 5, 9)
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#E5E5EA', // Gray background for others' messages (AC: 5, 9)
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
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 11,
    color: '#8E8E93',
  },
  syncingText: {
    fontSize: 11,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  spacer: {
    width: 40, // Space for avatar on the other side (for alignment)
  },
});
