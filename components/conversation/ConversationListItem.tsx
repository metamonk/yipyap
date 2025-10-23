/**
 * Conversation list item component
 *
 * @remarks
 * Displays a single conversation in the conversation list with participant info,
 * last message preview, timestamp, and unread count badge.
 */

import React, { FC, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { formatRelativeTime } from '@/utils/dateHelpers';
import type { Conversation } from '@/types/models';

/**
 * Props for the ConversationListItem component
 */
export interface ConversationListItemProps {
  /** The conversation data to display */
  conversation: Conversation;

  /** Current user's ID (used to determine unread count) */
  currentUserId: string;

  /** Display name of the other participant */
  otherParticipantName: string;

  /** Profile photo URL of the other participant (null if no photo) */
  otherParticipantPhoto: string | null;

  /** User ID of the other participant (for direct conversations, used for presence) */
  otherParticipantId?: string;

  /** Callback fired when the conversation item is pressed */
  onPress: (conversationId: string) => void;
}

/**
 * Displays a single conversation in the conversation list
 *
 * @component
 *
 * @remarks
 * - Displays participant's profile photo using Avatar component
 * - Shows participant's display name
 * - Displays last message preview (truncated to 50 characters)
 * - Shows relative timestamp (e.g., "5m ago", "Yesterday")
 * - Displays unread count badge when applicable
 * - Uses memo() for performance optimization
 * - Tappable to navigate to the chat screen
 *
 * @example
 * ```tsx
 * <ConversationListItem
 *   conversation={conversationData}
 *   currentUserId="user123"
 *   otherParticipantName="Jane Smith"
 *   otherParticipantPhoto="https://example.com/photo.jpg"
 *   onPress={(id) => router.push(`/(tabs)/conversations/${id}`)}
 * />
 * ```
 */
export const ConversationListItem: FC<ConversationListItemProps> = memo(
  ({
    conversation,
    currentUserId,
    otherParticipantName,
    otherParticipantPhoto,
    otherParticipantId,
    onPress,
  }) => {
    const { id, type, lastMessage, lastMessageTimestamp, unreadCount } = conversation;

    // Get unread count for current user
    const userUnreadCount = unreadCount[currentUserId] || 0;

    // Truncate last message to 50 characters
    const MAX_PREVIEW_LENGTH = 50;
    const messagePreview =
      lastMessage.text.length > MAX_PREVIEW_LENGTH
        ? `${lastMessage.text.substring(0, MAX_PREVIEW_LENGTH)}...`
        : lastMessage.text;

    // Format timestamp
    const timeAgo = formatRelativeTime(lastMessageTimestamp);

    const handlePress = () => {
      onPress(id);
    };

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        testID="conversation-item"
        activeOpacity={0.7}
      >
        {/* Avatar with presence indicator */}
        <View style={styles.avatarContainer}>
          <Avatar photoURL={otherParticipantPhoto} displayName={otherParticipantName} size={48} />
          {type === 'direct' && otherParticipantId && (
            <View style={styles.presenceIndicator}>
              <PresenceIndicator userId={otherParticipantId} size="small" hideWhenOffline={false} />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top row: name and timestamp */}
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>
              {otherParticipantName}
            </Text>
            <Text style={styles.timestamp}>{timeAgo}</Text>
          </View>

          {/* Bottom row: message preview and badge */}
          <View style={styles.bottomRow}>
            <Text style={styles.preview} numberOfLines={1}>
              {messagePreview}
            </Text>
            {userUnreadCount > 0 && (
              <View style={styles.badgeContainer}>
                <Badge count={userUnreadCount} variant="primary" />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

ConversationListItem.displayName = 'ConversationListItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
  },
  presenceIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  badgeContainer: {
    marginLeft: 8,
  },
});
