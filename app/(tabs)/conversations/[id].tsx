/**
 * Chat screen for 1:1 messaging
 *
 * @remarks
 * Dynamic route screen that displays messages for a specific conversation.
 * Features real-time message updates, optimized FlatList rendering, and auto-scroll.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { MessageItem } from '@/components/chat/MessageItem';
import { MessageInput } from '@/components/chat/MessageInput';
import { DateSeparator } from '@/components/chat/DateSeparator';
import { SearchBar } from '@/components/chat/SearchBar';
import { Avatar } from '@/components/common/Avatar';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { useMarkAsRead } from '@/hooks/useMarkAsRead';
import { getConversation } from '@/services/conversationService';
import { getUserProfile } from '@/services/userService';
import { groupMessagesWithSeparators } from '@/utils/messageHelpers';
import type { Conversation, ChatListItem } from '@/types/models';
import type { User as UserProfile } from '@/types/user';

/**
 * Chat screen component for real-time 1:1 messaging
 *
 * @component
 *
 * @remarks
 * - Extracts conversation ID from route params (dynamic route)
 * - Displays messages in an optimized FlatList with performance optimizations
 * - Shows sender's avatar and name for received messages
 * - Auto-scrolls to bottom when new messages arrive
 * - Displays participant info in header
 * - Handles loading states for conversation and messages
 *
 * Route: `/(tabs)/conversations/[id]` where id is the conversation ID
 */
export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id: string;
    messageId?: string;
    isDraft?: string;
    recipientId?: string;
    type?: string;
    groupName?: string;
    participantIds?: string;
  }>();
  const conversationId = params.id;
  const targetMessageId = params.messageId;
  const isDraft = params.isDraft === 'true';
  const draftType = params.type as 'direct' | 'group' | undefined;
  const draftGroupName = params.groupName;
  const draftParticipantIds = params.participantIds?.split(',') || [];

  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  // Prepare draft params for useMessages if in draft mode
  // Memoize to prevent recreating object on every render (would cause unnecessary effect runs)
  const draftParams = useMemo(
    () =>
      isDraft && draftType
        ? {
            type: draftType,
            groupName: draftGroupName,
          }
        : undefined,
    [isDraft, draftType, draftGroupName]
  );

  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    flatListRef,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
    isOffline,
  } = useMessages(conversationId || '', user?.uid || '', conversation?.participantIds || [], draftParams);

  // Search functionality
  const { searchResults, isSearching, searchMessages, clearSearch } = useMessageSearch(messages);

  // Automatically mark messages as read when viewed
  useMarkAsRead(conversationId || '', messages);

  /**
   * Load conversation data and other participant's info
   */
  useEffect(() => {
    if (!conversationId || !user?.uid) {
      return;
    }

    const loadConversationData = async () => {
      try {
        // Handle draft mode - create mock conversation without Firestore fetch
        if (isDraft && draftType) {
          const participantIds =
            draftType === 'direct'
              ? [user.uid, params.recipientId!]
              : draftParticipantIds.length > 0
              ? draftParticipantIds
              : [user.uid];

          // Create a mock conversation object for draft mode
          const now = Timestamp.now();
          const draftConversation: Conversation = {
            id: conversationId,
            type: draftType,
            participantIds,
            ...(draftGroupName && { groupName: draftGroupName }),
            lastMessage: {
              text: '',
              senderId: user.uid,
              timestamp: now,
            },
            lastMessageTimestamp: now,
            unreadCount: {},
            archivedBy: {},
            deletedBy: {},
            mutedBy: {},
            createdAt: now,
            updatedAt: now,
          };

          setConversation(draftConversation);

          // For direct messages, load the other user's profile
          if (draftType === 'direct' && params.recipientId) {
            const userProfile = await getUserProfile(params.recipientId);
            setOtherUser(userProfile);
          }

          setConversationLoading(false);
          return;
        }

        // Normal mode - fetch conversation from Firestore
        const conv = await getConversation(conversationId);

        if (!conv) {
          console.error('Conversation not found');
          setConversationLoading(false);
          return;
        }

        setConversation(conv);

        // Get other participant's ID (for 1:1 conversations)
        const otherUserId = conv.participantIds.find((id) => id !== user.uid);

        if (otherUserId) {
          // Fetch other user's profile
          const userProfile = await getUserProfile(otherUserId);
          setOtherUser(userProfile);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setConversationLoading(false);
      }
    };

    loadConversationData();
  }, [conversationId, user?.uid, isDraft, draftType, draftGroupName, params.recipientId]);

  /**
   * Renders a single message or separator item
   */
  const renderItem = useCallback(
    ({ item }: { item: ChatListItem }) => {
      // Check if this is a date separator
      if (item.type === 'separator') {
        return <DateSeparator timestamp={item.timestamp} />;
      }

      // Render message item
      const message = item.data;
      const isOwnMessage = message.senderId === user?.uid;
      const isHighlighted = message.id === highlightedMessageId;

      // Get sender info
      const senderDisplayName = isOwnMessage
        ? user?.displayName || 'You'
        : otherUser?.displayName || 'Unknown';

      const senderPhotoURL = isOwnMessage ? user?.photoURL || null : otherUser?.photoURL || null;

      const messageItem = (
        <MessageItem
          message={message}
          isOwnMessage={isOwnMessage}
          senderDisplayName={senderDisplayName}
          senderPhotoURL={senderPhotoURL}
        />
      );

      // Wrap with highlight if this is the target message
      if (isHighlighted) {
        return (
          <Animated.View
            style={[
              styles.highlightContainer,
              {
                backgroundColor: highlightOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['transparent', '#FFF3CD'],
                }),
              },
            ]}
          >
            {messageItem}
          </Animated.View>
        );
      }

      return messageItem;
    },
    [user, otherUser, highlightedMessageId, highlightOpacity]
  );

  /**
   * Key extractor for FlatList optimization
   */
  const keyExtractor = useCallback((item: ChatListItem) => item.id, []);

  // Use search results if searching, otherwise use all messages
  const displayMessages = isSearching ? searchResults : messages;

  // Group messages with date separators
  const chatItems = groupMessagesWithSeparators(displayMessages);

  /**
   * Handle back navigation
   */
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/conversations');
    }
  };

  /**
   * Toggle search mode
   */
  const handleSearchToggle = () => {
    if (showSearch) {
      // Close search and clear query
      clearSearch();
    }
    setShowSearch(!showSearch);
  };

  /**
   * Handle search query change
   */
  const handleSearch = (query: string) => {
    searchMessages(query);
  };

  /**
   * Handle clear search
   */
  const handleClearSearch = () => {
    clearSearch();
  };

  /**
   * Scroll to and highlight target message (from search results)
   */
  useEffect(() => {
    if (!targetMessageId || !flatListRef.current || chatItems.length === 0) {
      return;
    }

    // Find the index of the target message in the chat items
    const messageIndex = chatItems.findIndex(
      (item) => item.type === 'message' && item.data.id === targetMessageId
    );

    if (messageIndex === -1) {
      console.warn('Target message not found in loaded messages');
      return;
    }

    // Wait for layout to complete, then scroll to message
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5, // Center the message in the viewport
        });

        // Highlight the message
        setHighlightedMessageId(targetMessageId);

        // Animate highlight in
        Animated.sequence([
          Animated.timing(highlightOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(2700), // Hold highlight for 2.7 seconds
          Animated.timing(highlightOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Clear highlighted message after animation
          setHighlightedMessageId(null);
        });
      } catch (error) {
        console.error('Error scrolling to message:', error);
      }
    }, 500); // Delay to ensure list has rendered
  }, [targetMessageId, chatItems.length, flatListRef, highlightOpacity]);

  // Show loading spinner while conversation data loads
  if (conversationLoading || !conversation) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton} testID="back-button">
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </TouchableOpacity>

        {otherUser && (
          <View style={styles.headerInfo}>
            <Avatar
              photoURL={otherUser.photoURL || null}
              displayName={otherUser.displayName}
              size={36}
            />
            <View style={styles.headerTextContainer}>
              <View style={styles.headerNameRow}>
                <Text style={styles.headerName}>{otherUser.displayName}</Text>
              </View>
              {conversation.type === 'direct' && (
                <PresenceIndicator userId={otherUser.id} size="small" showLastSeen={true} />
              )}
              {isOffline && (
                <Text style={styles.offlineIndicator}>
                  Offline - messages will send when connected
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Search Icon */}
        <TouchableOpacity
          onPress={handleSearchToggle}
          style={styles.searchButton}
          testID="search-toggle-button"
        >
          <Ionicons name={showSearch ? 'close' : 'search'} size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar (conditionally shown) */}
      {showSearch && (
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search messages..."
          testID="conversation-search-bar"
        />
      )}

      {/* Messages List */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {messagesLoading ? (
          <View style={styles.messagesLoadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            // Regular list: oldest messages at top, newest at bottom
            inverted={false}
            // Pagination: trigger when scrolled near the top (load older messages)
            onStartReached={loadMoreMessages}
            onStartReachedThreshold={0.5}
            // Performance optimizations
            removeClippedSubviews={true}
            windowSize={10}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={20}
            // Scroll position maintenance
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            // Loading indicator at top when fetching older messages
            ListHeaderComponent={
              isLoadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.loadingMoreText}>Loading older messages...</Text>
                </View>
              ) : !hasMore && messages.length > 0 ? (
                <View style={styles.loadingMoreContainer}>
                  <Text style={styles.endMessagesText}>No more messages</Text>
                </View>
              ) : null
            }
            // Empty state
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name={isSearching ? 'search-outline' : 'chatbubbles-outline'}
                  size={64}
                  color="#C7C7CC"
                />
                <Text style={styles.emptyStateText}>
                  {isSearching ? 'No messages found' : 'No messages yet. Start the conversation!'}
                </Text>
              </View>
            }
          />
        )}

        {/* Message Input */}
        <MessageInput onSend={sendMessage} disabled={!user} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    marginRight: 12,
  },
  searchButton: {
    marginLeft: 12,
    padding: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  offlineIndicator: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messagesLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  loadingMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  endMessagesText: {
    fontSize: 14,
    color: '#C7C7CC',
    fontStyle: 'italic',
  },
  highlightContainer: {
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 2,
  },
});
