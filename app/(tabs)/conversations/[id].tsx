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
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { MessageItem } from '@/components/chat/MessageItem';
import { MessageInput } from '@/components/chat/MessageInput';
import { DateSeparator } from '@/components/chat/DateSeparator';
import { SearchBar } from '@/components/chat/SearchBar';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { Avatar } from '@/components/common/Avatar';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import {
  getConversation,
  muteConversation,
  markConversationAsRead,
} from '@/services/conversationService';
import { getUserProfile } from '@/services/userService';
import { markMessageAsRead } from '@/services/messageService';
import { setActiveConversation } from '@/services/notificationService';
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
  const draftParticipantIds = useMemo(
    () => params.participantIds?.split(',') || [],
    [params.participantIds]
  );

  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
  } = useMessages(
    conversationId || '',
    user?.uid || '',
    conversation?.participantIds || [],
    draftParams
  );

  // Typing indicators
  const { typingUsers } = useTypingIndicator(conversationId, user?.uid);

  // Search functionality
  const { searchResults, isSearching, searchMessages, clearSearch } = useMessageSearch(messages);

  // Track messages that have been marked as read (for idempotency)
  const markedAsReadRef = useRef<Set<string>>(new Set());

  /**
   * Set active conversation for notification suppression
   */
  useEffect(() => {
    if (!conversationId) return;

    // Mark this conversation as active
    setActiveConversation(conversationId);

    // Clear active conversation when user leaves
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId]);

  /**
   * Reset unread count when conversation is opened
   */
  useEffect(() => {
    if (!conversationId || !user?.uid || isDraft) return;

    // Reset unread count for current user
    markConversationAsRead(conversationId, user.uid).catch((error) => {
      console.error('[ChatScreen] Failed to reset unread count:', error);
    });
  }, [conversationId, user?.uid, isDraft]);

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
        // Implement retry logic for newly created conversations (eventual consistency)
        let conv = await getConversation(conversationId);

        // If conversation not found, retry a few times with exponential backoff
        // This handles Firestore eventual consistency for newly created conversations
        if (!conv) {
          const maxRetries = 3;
          const baseDelay = 500; // Start with 500ms

          for (let i = 0; i < maxRetries; i++) {
            const delay = baseDelay * Math.pow(2, i); // Exponential backoff: 500ms, 1s, 2s
            console.log(
              `Conversation not found, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
            conv = await getConversation(conversationId);

            if (conv) {
              console.log('Conversation found after retry');
              break;
            }
          }
        }

        if (!conv) {
          console.error('Conversation not found after retries');
          setConversationError('Unable to load conversation. Please try again.');
          setConversationLoading(false);
          return;
        }

        setConversation(conv);

        // Set mute status for current user
        if (user?.uid) {
          setIsMuted(conv.mutedBy?.[user.uid] === true);
        }

        // Get other participant's profile (for direct conversations only)
        if (conv.type === 'direct') {
          const otherUserId = conv.participantIds.find((id) => id !== user.uid);

          if (otherUserId) {
            // Fetch other user's profile
            const userProfile = await getUserProfile(otherUserId);
            setOtherUser(userProfile);
          }
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setConversationLoading(false);
      }
    };

    loadConversationData();
  }, [
    conversationId,
    user?.uid,
    isDraft,
    draftType,
    draftGroupName,
    draftParticipantIds,
    params.recipientId,
  ]);

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
      // For group chats, we'll show sender ID as a fallback until we implement participant profiles
      // For direct chats, we use the otherUser profile
      const senderDisplayName = isOwnMessage
        ? user?.displayName || 'You'
        : conversation?.type === 'direct'
          ? otherUser?.displayName || 'Unknown'
          : 'Group Member'; // TODO: Implement participant profile cache for group chats

      const senderPhotoURL = isOwnMessage
        ? user?.photoURL || null
        : conversation?.type === 'direct'
          ? otherUser?.photoURL || null
          : null; // TODO: Implement participant profile cache for group chats

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

  /**
   * Viewability configuration for read receipts (AC1, AC8)
   * Messages must be 50% visible for 500ms before being marked as read
   */
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
    waitForInteraction: false,
  }).current;

  /**
   * Handle viewport changes for read receipts (AC1, AC3, AC8)
   * Marks messages as read when they become visible in viewport
   */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ChatListItem; isViewable: boolean }> }) => {
      if (!user?.uid || !conversationId) {
        return;
      }

      // Filter to messages that just became viewable and should be marked as read
      const messagesToMarkAsRead = viewableItems
        .filter((viewableItem) => {
          // Only process message items (not date separators)
          if (viewableItem.item.type !== 'message') {
            return false;
          }

          const message = viewableItem.item.data;

          // Only mark messages from other users
          if (message.senderId === user.uid) {
            return false;
          }

          // Only mark messages that are currently 'delivered' (AC5 sequencing)
          if (message.status !== 'delivered') {
            return false;
          }

          // Check if we've already marked this message (idempotency - AC8)
          if (markedAsReadRef.current.has(message.id)) {
            return false;
          }

          return true;
        })
        .map((viewableItem) => viewableItem.item.data);

      // Mark messages as read
      messagesToMarkAsRead.forEach((message) => {
        // Track locally to prevent duplicate updates (AC8)
        markedAsReadRef.current.add(message.id);

        // Call service to update Firestore (AC3)
        markMessageAsRead(conversationId, message.id, user.uid).catch((error) => {
          console.error('Failed to mark message as read:', error);
          // Remove from tracking so we can retry
          markedAsReadRef.current.delete(message.id);
        });
      });
    }
  ).current;

  // Clear marked messages ref when conversation changes
  useEffect(() => {
    markedAsReadRef.current.clear();
  }, [conversationId]);

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
   * Handle menu toggle
   */
  const handleMenuToggle = () => {
    setShowMenu(!showMenu);
  };

  /**
   * Handle mute/unmute conversation
   */
  const handleMuteToggle = async () => {
    if (!user?.uid || !conversationId || isDraft) {
      return;
    }

    setShowMenu(false);

    try {
      const newMuteState = !isMuted;
      await muteConversation(conversationId, user.uid, newMuteState);

      // Update local state optimistically
      setIsMuted(newMuteState);

      // Update conversation state
      if (conversation) {
        setConversation({
          ...conversation,
          mutedBy: {
            ...conversation.mutedBy,
            [user.uid]: newMuteState,
          },
        });
      }

      const message = newMuteState ? 'Conversation muted' : 'Conversation unmuted';
      Alert.alert('Success', message);
    } catch (error) {
      console.error('Error muting conversation:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flatListRef and highlightOpacity are stable refs
  }, [targetMessageId, chatItems]);

  // Show loading spinner while conversation data loads
  if (conversationLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </SafeAreaView>
    );
  }

  // Show error state if conversation failed to load
  if (!conversation) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>{conversationError || 'Unable to load conversation'}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/conversations');
            }
          }}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
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

        <View style={styles.headerInfo}>
          {conversation.type === 'group' ? (
            // Group conversation header
            <>
              <Avatar
                photoURL={conversation.groupPhotoURL || null}
                displayName={conversation.groupName || 'Group Chat'}
                size={36}
              />
              <View style={styles.headerTextContainer}>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerName}>{conversation.groupName || 'Group Chat'}</Text>
                </View>
                <Text style={styles.headerSubtext}>
                  {conversation.participantIds.length} participants
                </Text>
                {isOffline && (
                  <Text style={styles.offlineIndicator}>
                    Offline - messages will send when connected
                  </Text>
                )}
              </View>
            </>
          ) : otherUser ? (
            // Direct conversation header
            <>
              <Avatar
                photoURL={otherUser.photoURL || null}
                displayName={otherUser.displayName}
                size={36}
              />
              <View style={styles.headerTextContainer}>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerName}>{otherUser.displayName}</Text>
                </View>
                <PresenceIndicator userId={otherUser.id} size="small" showLastSeen={true} />
                {isOffline && (
                  <Text style={styles.offlineIndicator}>
                    Offline - messages will send when connected
                  </Text>
                )}
              </View>
            </>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleSearchToggle}
            style={styles.iconButton}
            testID="search-toggle-button"
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={24} color="#007AFF" />
          </TouchableOpacity>

          {!isDraft && (
            <TouchableOpacity
              onPress={handleMenuToggle}
              style={styles.iconButton}
              testID="menu-button"
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleMuteToggle}>
              <Ionicons
                name={isMuted ? 'notifications' : 'notifications-off'}
                size={22}
                color="#007AFF"
              />
              <Text style={styles.menuItemText}>
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => setShowMenu(false)}
            >
              <Ionicons name="close" size={22} color="#8E8E93" />
              <Text style={[styles.menuItemText, styles.menuItemTextMuted]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            // Read receipts viewport detection (AC1, AC8)
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
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

        {/* Typing Indicator - positioned above MessageInput */}
        {typingUsers.length > 0 && <TypingIndicator typingUsers={typingUsers} />}

        {/* Message Input */}
        <MessageInput
          onSend={sendMessage}
          conversationId={conversationId || ''}
          userId={user?.uid || ''}
          disabled={!user}
        />
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
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
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
  headerSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#000000',
  },
  menuItemTextMuted: {
    color: '#8E8E93',
  },
});
