/**
 * Conversation list item component
 *
 * @remarks
 * Displays a single conversation in the conversation list with participant info,
 * last message preview, timestamp, and unread count badge.
 */

import React, { FC, memo, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AccessibilityInfo } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/common/Avatar';
import { CompositeAvatar } from '@/components/common/CompositeAvatar';
import { Badge } from '@/components/common/Badge';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { SentimentBadge } from '@/components/conversation/SentimentBadge';
import { OpportunityBadge } from '@/components/conversation/OpportunityBadge';
import { formatRelativeTime } from '@/utils/dateHelpers';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import type { Conversation } from '@/types/models';

/**
 * Props for the ConversationListItem component
 */
export interface ConversationListItemProps {
  /** The conversation data to display */
  conversation: Conversation;

  /** Current user's ID (used to determine unread count) */
  currentUserId: string;

  /** Display name of the other participant (for direct chats) or group name */
  otherParticipantName: string;

  /** Profile photo URL of the other participant (null if no photo) */
  otherParticipantPhoto: string | null;

  /** User ID of the other participant (for direct conversations, used for presence) */
  otherParticipantId?: string;

  /** Array of participants for group conversations */
  participants?: Array<{
    photoURL?: string | null;
    displayName: string;
    uid: string;
  }>;

  /** Callback fired when the conversation item is pressed */
  onPress: (conversationId: string) => void;

  /** Callback fired when archive/unarchive action is triggered */
  onArchive?: (conversationId: string, archive: boolean) => void;

  /** Callback fired when delete action is triggered */
  onDelete?: (conversationId: string) => void;

  /** Whether this item is in the archived list (shows Unarchive instead of Archive) */
  isArchived?: boolean;

  /** Whether selection mode is active (Story 4.7) */
  isSelectionMode?: boolean;

  /** Whether this conversation is currently selected (Story 4.7) */
  isSelected?: boolean;

  /** Callback fired when the conversation item is long-pressed (Story 4.7) */
  onLongPress?: () => void;

  /** Callback fired when the conversation selection is toggled (Story 4.7) */
  onToggleSelect?: () => void;
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
    participants,
    onPress,
    onArchive,
    onDelete,
    isArchived = false,
    isSelectionMode = false,
    isSelected = false,
    onLongPress,
    onToggleSelect,
  }) => {
    const { id, type, lastMessage, lastMessageTimestamp, unreadCount, mutedBy, sentimentStats } = conversation;
    const swipeableRef = useRef<Swipeable>(null);

    // State for opportunity score (Story 5.6)
    const [opportunityScore, setOpportunityScore] = useState<number>(0);

    // Get unread count for current user
    const userUnreadCount = unreadCount[currentUserId] || 0;

    // Check if conversation is muted by current user
    const isMuted = mutedBy?.[currentUserId] === true;

    // Check for crisis (Story 5.3)
    const hasCrisis = sentimentStats?.hasCrisis === true;
    const lastSentiment = sentimentStats?.lastSentiment;
    const lastSentimentScore = sentimentStats?.lastSentimentScore;

    // Announce crisis to screen readers when crisis is detected (Story 5.3)
    useEffect(() => {
      if (hasCrisis) {
        AccessibilityInfo.announceForAccessibility(
          `Urgent: Crisis detected in conversation with ${otherParticipantName}`
        );
      }
    }, [hasCrisis, otherParticipantName]);

    // Subscribe to highest opportunity score in this conversation (Story 5.6)
    useEffect(() => {
      // Query for messages with opportunity scores in this conversation
      const db = getFirebaseDb();
      const messagesQuery = query(
        collection(db, 'conversations', id, 'messages'),
        where('metadata.opportunityScore', '>', 0),
        orderBy('metadata.opportunityScore', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const topMessage = snapshot.docs[0].data();
            const score = topMessage.metadata?.opportunityScore || 0;
            setOpportunityScore(score);
          } else {
            setOpportunityScore(0);
          }
        },
        (error) => {
          console.error('Failed to query opportunity score:', error);
          setOpportunityScore(0);
        }
      );

      return () => unsubscribe();
    }, [id]);

    // Truncate last message to 50 characters
    const MAX_PREVIEW_LENGTH = 50;
    const messagePreview =
      lastMessage.text.length > MAX_PREVIEW_LENGTH
        ? `${lastMessage.text.substring(0, MAX_PREVIEW_LENGTH)}...`
        : lastMessage.text;

    // Format timestamp
    const timeAgo = formatRelativeTime(lastMessageTimestamp);

    const handlePress = () => {
      // In selection mode, tap toggles selection instead of navigating
      if (isSelectionMode && onToggleSelect) {
        onToggleSelect();
      } else {
        onPress(id);
      }
    };

    const handleArchive = () => {
      if (onArchive) {
        onArchive(id, !isArchived); // Toggle archive state
        swipeableRef.current?.close();
      }
    };

    const handleDelete = () => {
      if (onDelete) {
        onDelete(id);
        swipeableRef.current?.close();
      }
    };

    const renderRightActions = () => {
      if (!onArchive && !onDelete) return null;

      return (
        <View style={styles.actionsContainer}>
          {onArchive && (
            <TouchableOpacity
              style={styles.archiveAction}
              onPress={handleArchive}
              activeOpacity={0.7}
              testID={isArchived ? 'unarchive-button' : 'archive-button'}
            >
              <Ionicons
                name={isArchived ? 'archive-outline' : 'archive'}
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.archiveText}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteAction}
              onPress={handleDelete}
              activeOpacity={0.7}
              testID="delete-button"
            >
              <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    };

    const conversationItem = (
      <TouchableOpacity
        style={[
          styles.container,
          isSelected && styles.selectedContainer,
          hasCrisis && styles.crisisContainer,
        ]}
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={500}
        testID="conversation-item"
        activeOpacity={0.7}
        accessibilityLabel={
          hasCrisis
            ? `Crisis detected. Conversation with ${otherParticipantName}`
            : `Conversation with ${otherParticipantName}`
        }
      >
        {/* Checkbox (Story 4.7) - shown in selection mode */}
        {isSelectionMode && (
          <View style={styles.checkboxContainer}>
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isSelected ? '#007AFF' : '#999'}
            />
          </View>
        )}

        {/* Avatar with presence indicator */}
        <View style={styles.avatarContainer}>
          {type === 'group' && participants ? (
            <CompositeAvatar
              participants={participants.filter((p) => p.uid !== currentUserId)}
              size={48}
            />
          ) : (
            <Avatar photoURL={otherParticipantPhoto} displayName={otherParticipantName} size={48} />
          )}
          {type === 'direct' && otherParticipantId && (
            <View style={styles.presenceIndicator}>
              <PresenceIndicator userId={otherParticipantId} size="small" hideWhenOffline={false} />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top row: name, mute icon, sentiment badge, opportunity badge, and timestamp */}
          <View style={styles.topRow}>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>
                {otherParticipantName}
              </Text>
              {isMuted && (
                <Ionicons
                  name="notifications-off-outline"
                  size={16}
                  color="#8E8E93"
                  style={styles.muteIcon}
                />
              )}
              {lastSentiment && lastSentimentScore !== undefined && (
                <View style={styles.sentimentBadgeContainer}>
                  <SentimentBadge
                    sentiment={lastSentiment}
                    sentimentScore={lastSentimentScore}
                    size="small"
                  />
                </View>
              )}
              {/* Opportunity Badge (Story 5.6) - show only for high-value (>= 70) */}
              {opportunityScore >= 70 && (
                <View style={styles.opportunityBadgeContainer}>
                  <OpportunityBadge score={opportunityScore} size="small" />
                </View>
              )}
            </View>
            <Text style={styles.timestamp}>{timeAgo}</Text>
          </View>

          {/* Bottom row: message preview and badge */}
          <View style={styles.bottomRow}>
            <Text style={styles.preview} numberOfLines={1}>
              {type === 'group' && conversation.participantIds
                ? `${conversation.participantIds.length} members • ${messagePreview}`
                : messagePreview}
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

    // If onArchive or onDelete is provided, wrap in Swipeable
    if (onArchive || onDelete) {
      return (
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
        >
          {conversationItem}
        </Swipeable>
      );
    }

    // Otherwise return plain item
    return conversationItem;
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
  selectedContainer: {
    backgroundColor: '#E3F2FD',
  },
  crisisContainer: {
    backgroundColor: '#FFEBEE', // Light red background for crisis (WCAG AA compliant)
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444', // Red accent border for crisis
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginRight: 12,
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
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flexShrink: 1,
  },
  muteIcon: {
    marginLeft: 6,
  },
  sentimentBadgeContainer: {
    marginLeft: 6,
  },
  opportunityBadgeContainer: {
    marginLeft: 6,
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
  actionsContainer: {
    flexDirection: 'row',
  },
  archiveAction: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  archiveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
