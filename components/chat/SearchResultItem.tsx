import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Message } from '@/types/models';
import { formatRelativeTime } from '@/utils/dateHelpers';

/**
 * Props for the SearchResultItem component
 */
export interface SearchResultItemProps {
  /** The message that matches the search query */
  message: Message;

  /** Display name of the conversation (other participant name or group name) */
  conversationName: string;

  /** Display name of the message sender */
  senderName: string;

  /** Profile photo URL of the message sender (optional) */
  senderPhotoURL?: string;

  /** Callback fired when the result item is tapped */
  onPress: () => void;

  /** Test ID for automated testing */
  testID?: string;
}

const MAX_PREVIEW_LENGTH = 100; // characters

/**
 * Displays a single search result with message preview and context
 *
 * @component
 * @remarks
 * This component shows a message search result with:
 * - Sender's profile photo (or placeholder avatar)
 * - Sender's name
 * - Conversation context
 * - Message text preview (truncated to 100 characters)
 * - Relative timestamp
 *
 * The entire item is tappable and navigates to the specific message
 * in its conversation when pressed.
 *
 * Performance: Memoized with React.memo to prevent unnecessary re-renders
 * when parent components update.
 *
 * @example
 * ```tsx
 * <SearchResultItem
 *   message={messageData}
 *   conversationName="John Doe"
 *   senderName="John Doe"
 *   senderPhotoURL="https://..."
 *   onPress={() => navigateToMessage(messageData.id)}
 *   testID="search-result-0"
 * />
 * ```
 */
export const SearchResultItem = memo<SearchResultItemProps>(
  ({ message, conversationName, senderName, senderPhotoURL, onPress, testID }) => {
    /**
     * Truncates message text to MAX_PREVIEW_LENGTH with ellipsis
     */
    const truncateText = (text: string): string => {
      if (text.length <= MAX_PREVIEW_LENGTH) {
        return text;
      }
      return text.substring(0, MAX_PREVIEW_LENGTH) + '...';
    };

    const messagePreview = truncateText(message.text);
    const timeLabel = formatRelativeTime(message.timestamp);

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
        testID={testID}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {senderPhotoURL ? (
            <Image
              source={{ uri: senderPhotoURL }}
              style={styles.avatar}
              testID={testID ? `${testID}-avatar` : 'search-result-avatar'}
            />
          ) : (
            <View
              style={styles.avatarPlaceholder}
              testID={testID ? `${testID}-avatar-placeholder` : 'search-result-avatar-placeholder'}
            >
              <Text style={styles.avatarPlaceholderText}>{senderName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top Row: Sender Name and Timestamp */}
          <View style={styles.topRow}>
            <Text style={styles.senderName} numberOfLines={1}>
              {senderName}
            </Text>
            <Text style={styles.timestamp}>{timeLabel}</Text>
          </View>

          {/* Conversation Name */}
          <Text style={styles.conversationName} numberOfLines={1}>
            in {conversationName}
          </Text>

          {/* Message Preview */}
          <Text
            style={styles.messagePreview}
            numberOfLines={2}
            testID={testID ? `${testID}-preview` : 'search-result-preview'}
          >
            {messagePreview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
);

SearchResultItem.displayName = 'SearchResultItem';

/**
 * Color palette for consistent styling
 */
const COLORS = {
  primary: '#007AFF', // iOS blue
  background: '#FFFFFF',
  secondaryBg: '#F2F2F7',
  border: '#E5E5EA',
  text: '#000000',
  secondaryText: '#8E8E93',
  avatarBg: '#E5E5EA',
  avatarText: '#8E8E93',
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.avatarText,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  conversationName: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 18,
  },
});
