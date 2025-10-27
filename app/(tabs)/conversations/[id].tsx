/**
 * Chat screen for 1:1 and group messaging
 *
 * @remarks
 * Dynamic route screen that displays messages for a specific conversation.
 * Features real-time message updates, optimized FlatList rendering, auto-scroll,
 * and sender attribution for group conversations.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { MessageItem } from '@/components/chat/MessageItem';
import { MessageInput } from '@/components/chat/MessageInput';
import { DateSeparator } from '@/components/chat/DateSeparator';
import { SearchBar } from '@/components/chat/SearchBar';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { Avatar } from '@/components/common/Avatar';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { ConversationSettings } from '@/components/conversation/ConversationSettings';
import { ResponseDraftCard } from '@/components/voice/ResponseDraftCard';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import {
  getConversation,
  muteConversation,
  markConversationAsRead,
} from '@/services/conversationService';
import { getUserProfile, getUserProfiles } from '@/services/userService';
import { markMessageAsRead } from '@/services/messageService';
import { setActiveConversation } from '@/services/notificationService';
import { voiceMatchingService } from '@/services/voiceMatchingService';
import { draftManagementService } from '@/services/draftManagementService';
import { groupMessagesWithSeparators } from '@/utils/messageHelpers';
import type { Conversation, ChatListItem, Message } from '@/types/models';
import type { User as UserProfile } from '@/types/user';
import type { ResponseDraft } from '@/types/ai';

/**
 * Chat screen component for real-time 1:1 and group messaging
 *
 * @component
 *
 * @remarks
 * - Extracts conversation ID from route params (dynamic route)
 * - Displays messages in an optimized FlatList with performance optimizations
 * - Shows sender's avatar and name for ALL messages in group chats (AC: 2, 5)
 * - Shows sender's avatar and name for received messages in 1:1 chats
 * - Auto-scrolls to bottom when new messages arrive
 * - Displays participant info in header
 * - Handles loading states for conversation and messages
 * - Fetches and caches participant profiles for group conversations (Task 5)
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

  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, UserProfile>>(
    new Map()
  );
  const [conversationLoading, setConversationLoading] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  // Draft management state
  const [activeDraft, setActiveDraft] = useState<ResponseDraft | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isRegeneratingDraft, setIsRegeneratingDraft] = useState(false);
  const [draftMessageId, setDraftMessageId] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const previousDrafts = useRef<string[]>([]);
  const [draftTextToPopulate, setDraftTextToPopulate] = useState<string | undefined>(undefined);

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

  // Track whether we've reset the conversation count during this viewing session
  const conversationCountResetRef = useRef<boolean>(false);

  // CRITICAL: Store current user and conversation IDs in refs for viewability callback
  // The viewability callback is wrapped in useRef (must be stable reference for FlatList)
  // but needs access to current values. Using refs solves the closure issue.
  const userIdRef = useRef<string | undefined>(user?.uid);
  const conversationIdRef = useRef<string>(conversationId);

  // Update refs when values change
  useEffect(() => {
    userIdRef.current = user?.uid;
  }, [user?.uid]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

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
   * Reset unread count when conversation gains focus
   * Ensures badge clears even when messages arrive while user is viewing the conversation
   */
  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !user?.uid || isDraft) return;

      markConversationAsRead(conversationId, user.uid).catch((error) => {
        console.error('[ChatScreen] Failed to reset unread count:', error);
      });
    }, [conversationId, user?.uid, isDraft])
  );

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
            console.warn(
              `Conversation not found, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
            conv = await getConversation(conversationId);

            if (conv) {
              console.warn('Conversation found after retry');
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

        // Get participant profiles based on conversation type
        if (conv.type === 'group') {
          // For group conversations, fetch all participant profiles (AC: 2, Task 5)
          const profiles = await getUserProfiles(conv.participantIds);
          const profileMap = new Map(profiles.map((p) => [p.uid, p]));
          setParticipantProfiles(profileMap);
        } else if (conv.type === 'direct') {
          // For direct conversations, fetch the other user's profile
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
      const isGroupChat = conversation?.type === 'group';

      // Get sender info based on conversation type (AC: 2, Task 5)
      let senderDisplayName: string;
      let senderPhotoURL: string | null;

      if (isGroupChat) {
        // For group chats, get sender info from participant profiles cache
        const senderProfile = participantProfiles.get(message.senderId);
        // Use metadata.senderDisplayName as fallback for auto-responses
        senderDisplayName = senderProfile?.displayName || message.metadata?.senderDisplayName || 'Unknown User';
        senderPhotoURL = senderProfile?.photoURL || null;
      } else {
        // For direct chats, use current user or other user info
        senderDisplayName = isOwnMessage
          ? user?.displayName || 'You'
          : otherUser?.displayName || message.metadata?.senderDisplayName || 'Unknown';
        senderPhotoURL = isOwnMessage ? user?.photoURL || null : otherUser?.photoURL || null;
      }

      const messageItem = (
        <MessageItem
          message={message}
          isOwnMessage={isOwnMessage}
          senderDisplayName={senderDisplayName}
          senderPhotoURL={senderPhotoURL}
          isGroupChat={isGroupChat}
          participantIds={conversation?.participantIds || draftParticipantIds || []}
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
    [
      user,
      otherUser,
      conversation?.type,
      conversation?.participantIds,
      participantProfiles,
      highlightedMessageId,
      highlightOpacity,
      draftParticipantIds,
    ]
  );

  /**
   * Key extractor for FlatList optimization
   */
  const keyExtractor = useCallback((item: ChatListItem) => item.id, []);

  /**
   * Viewability configuration for read receipts (AC1, AC8)
   * Messages must be 50% visible for 500ms before being marked as read
   *
   * CRITICAL: This must be a stable reference (useRef) to prevent FlatList from
   * re-registering the callback on every render
   */
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50, // 50% of item must be visible
    minimumViewTime: 500, // Must be visible for 500ms
    waitForInteraction: false, // Fire automatically, don't wait for user interaction
  }).current;

  /**
   * Handle viewport changes for read receipts (AC1, AC3, AC8)
   * Marks messages as read when they become visible in viewport
   * Also resets conversation-level unread count on first viewable message
   *
   * CRITICAL: This must be a stable reference (useRef) to prevent FlatList from
   * re-registering the callback on every render. Uses refs to access current values
   * to avoid closure issues.
   */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ChatListItem; isViewable: boolean }> }) => {
      // Access current values from refs (not closure)
      const currentUserId = userIdRef.current;
      const currentConversationId = conversationIdRef.current;

      if (!currentUserId || !currentConversationId) {
        return;
      }

      // Filter to messages that just became viewable and should be marked as read
      const messagesToMarkAsRead: Message[] = [];

      for (const viewableItem of viewableItems) {
        const item = viewableItem.item;

        // Only process message items (not date separators)
        if (item.type !== 'message') {
          continue;
        }

        const message = item.data;

        // Only mark messages from other users
        if (message.senderId === currentUserId) {
          continue;
        }

        // Only mark messages that are currently 'delivered' (AC5 sequencing)
        if (message.status !== 'delivered') {
          continue;
        }

        // Check if we've already marked this message (idempotency - AC8)
        if (markedAsReadRef.current.has(message.id)) {
          continue;
        }

        messagesToMarkAsRead.push(message);
      }

      // Mark individual messages as read
      messagesToMarkAsRead.forEach((message) => {
        // Track locally to prevent duplicate updates (AC8)
        markedAsReadRef.current.add(message.id);

        // Call service to update Firestore (AC3)
        markMessageAsRead(currentConversationId, message.id, currentUserId).catch((error) => {
          console.error('Failed to mark message as read:', error);
          // Remove from tracking so we can retry
          markedAsReadRef.current.delete(message.id);
        });
      });

      // Reset conversation-level unread count when viewing messages
      // Ensures badge clears even if messages arrived while actively viewing
      // Only call once per viewing session for efficiency (idempotent operation)
      if (messagesToMarkAsRead.length > 0 && !conversationCountResetRef.current) {
        conversationCountResetRef.current = true;

        markConversationAsRead(currentConversationId, currentUserId).catch((error) => {
          console.error('Failed to reset conversation unread count:', error);
          // Reset flag to allow retry
          conversationCountResetRef.current = false;
        });
      }
    }
  ).current;

  // Clear tracking refs when conversation changes
  useEffect(() => {
    markedAsReadRef.current.clear();
    conversationCountResetRef.current = false;
  }, [conversationId]);

  // Track when messages are ready for viewability tracking
  useEffect(() => {
    // This effect ensures viewability callbacks are ready when messages load
  }, [messagesLoading, messages]);

  // Use search results if searching, otherwise use all messages
  const displayMessages = isSearching ? searchResults : messages;

  // Group messages with date separators
  // NOTE: groupMessagesWithSeparators expects oldest-first order (ASC)
  // but messages are now newest-first (DESC) for inverted FlatList.
  // Solution: Reverse before grouping, then reverse result to restore DESC order.
  const chatItems = groupMessagesWithSeparators(
    displayMessages.slice().reverse() // Pass oldest-first to function
  ).reverse(); // Reverse result back to newest-first for inverted list

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
   * Generate draft for a specific message
   * @param messageId - The message ID to generate a draft for
   * @param openModal - Whether to open the modal after generation (default: false for auto-gen)
   */
  const handleGenerateDraft = useCallback(async (messageId: string, openModal: boolean = false) => {
    if (!user?.uid || !conversationId || isGeneratingDraft) {
      return;
    }

    setIsGeneratingDraft(true);
    setDraftMessageId(messageId);

    try {
      const result = await voiceMatchingService.generateDraft(
        conversationId,
        messageId
      );

      if (result.success && result.draft) {
        setActiveDraft(result.draft);
        previousDrafts.current = [result.draft.text];
        // Only open modal if explicitly requested (manual generation)
        if (openModal) {
          setShowDraftModal(true);
        }
      } else {
        // Only show alert for manual generation
        if (openModal) {
          Alert.alert('Error', result.error || 'Failed to generate draft. Please try again.');
        } else {
          console.error('Draft generation failed:', result.error);
        }
      }
    } catch (error) {
      console.error('Error generating draft:', error);
      // Only show alert for manual generation
      if (openModal) {
        Alert.alert('Error', 'Failed to generate draft. Please try again.');
      }
    } finally {
      setIsGeneratingDraft(false);
    }
  }, [user?.uid, conversationId, isGeneratingDraft]);

  /**
   * Auto-generate draft for incoming messages (background, non-invasive)
   * Only generates if user has autoShowSuggestions enabled
   * Stores in activeDraft state without populating input field
   */
  useEffect(() => {
    // Skip if conditions not met
    if (
      !conversationId ||
      !user?.uid ||
      !userProfile?.settings?.voiceMatching?.enabled ||
      !userProfile?.settings?.voiceMatching?.autoShowSuggestions ||
      messages.length === 0
    ) {
      return;
    }

    // Get the last message
    const lastMessage = messages[0]; // messages are ordered desc by timestamp

    // Only auto-generate for incoming messages (not from current user)
    if (lastMessage.senderId === user.uid) {
      return;
    }

    // Check if we already have a draft for this message
    if (activeDraft?.messageId === lastMessage.id) {
      return;
    }

    // Check if we're already generating
    if (isGeneratingDraft) {
      return;
    }

    // Auto-generate draft silently in background
    handleGenerateDraft(lastMessage.id);
  }, [
    messages,
    conversationId,
    user?.uid,
    userProfile?.settings?.voiceMatching?.enabled,
    userProfile?.settings?.voiceMatching?.autoShowSuggestions,
    activeDraft?.messageId,
    isGeneratingDraft,
    handleGenerateDraft,
  ]);

  /**
   * Send draft as message
   */
  const handleSendDraft = useCallback(async (
    text: string,
    metadata: {
      wasEdited: boolean;
      editCount: number;
      timeToEdit: number;
      overrideApplied: boolean;
    }
  ) => {
    if (!user?.uid || !conversationId || !draftMessageId) {
      return;
    }

    try {
      // Send the message using the existing sendMessage function
      // TODO: Add metadata tracking to the message (Story 6.2 - Analytics)
      // This will require extending the sendMessage function to accept metadata
      await sendMessage(text);

      // Clear draft state and close modal
      setActiveDraft(null);
      setDraftMessageId(null);
      previousDrafts.current = [];
      setShowDraftModal(false);
    } catch (error) {
      console.error('Error sending draft:', error);
      throw error;
    }
  }, [user?.uid, conversationId, draftMessageId, activeDraft, sendMessage]);

  /**
   * Discard draft
   */
  const handleDiscardDraft = useCallback(() => {
    setActiveDraft(null);
    setDraftMessageId(null);
    previousDrafts.current = [];
    setShowDraftModal(false);
  }, []);

  /**
   * Close draft modal
   */
  const handleCloseDraftModal = useCallback(() => {
    setShowDraftModal(false);
  }, []);

  /**
   * Regenerate draft (create new version)
   */
  const handleRegenerateDraft = useCallback(async () => {
    if (!user?.uid || !conversationId || !draftMessageId || isRegeneratingDraft) {
      return;
    }

    setIsRegeneratingDraft(true);

    try {
      const result = await voiceMatchingService.regenerateDraft(
        conversationId,
        draftMessageId,
        previousDrafts.current
      );

      if (result.success && result.draft) {
        setActiveDraft(result.draft);
        previousDrafts.current.push(result.draft.text);
      } else {
        Alert.alert('Error', result.error || 'Failed to regenerate draft. Please try again.');
      }
    } catch (error) {
      console.error('Error regenerating draft:', error);
      Alert.alert('Error', 'Failed to regenerate draft. Please try again.');
    } finally {
      setIsRegeneratingDraft(false);
    }
  }, [user?.uid, conversationId, draftMessageId, isRegeneratingDraft]);

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

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
    },
    errorText: {
      marginTop: 12,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.error,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    retryButton: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 32,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.md,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: 12,
      backgroundColor: theme.colors.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    headerName: {
      fontSize: 18,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    headerSubtext: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    offlineIndicator: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.warning || '#FF9500',
      marginTop: 2,
    },
    emptyStateText: {
      marginTop: theme.spacing.base,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    loadingMoreText: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    endMessagesText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textTertiary,
      fontStyle: 'italic',
    },
    menuContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      minWidth: 250,
      ...theme.shadows.lg,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    menuItemText: {
      marginLeft: 12,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
    },
    menuItemTextMuted: {
      color: theme.colors.textSecondary,
    },
  });

  // Show loading spinner while conversation data loads
  if (conversationLoading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={dynamicStyles.loadingText}>Loading conversation...</Text>
      </SafeAreaView>
    );
  }

  // Show error state if conversation failed to load
  if (!conversation) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.error} />
        <Text style={dynamicStyles.errorText}>{conversationError || 'Unable to load conversation'}</Text>
        <TouchableOpacity
          style={dynamicStyles.retryButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/conversations');
            }
          }}
        >
          <Text style={dynamicStyles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton} testID="back-button">
          <Ionicons name="chevron-back" size={28} color={theme.colors.accent} />
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
                  <Text style={dynamicStyles.headerName}>{conversation.groupName || 'Group Chat'}</Text>
                </View>
                <Text style={dynamicStyles.headerSubtext}>
                  {conversation.participantIds.length} participants
                </Text>
                {isOffline && (
                  <Text style={dynamicStyles.offlineIndicator}>
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
                  <Text style={dynamicStyles.headerName}>{otherUser.displayName}</Text>
                </View>
                <PresenceIndicator
                  userId={otherUser.uid}
                  size="small"
                  showLastSeen={true}
                  showStatusText={true}
                />
                {isOffline && (
                  <Text style={dynamicStyles.offlineIndicator}>
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
            <Ionicons name={showSearch ? 'close' : 'search'} size={24} color={theme.colors.accent} />
          </TouchableOpacity>

          {!isDraft && (
            <TouchableOpacity
              onPress={handleMenuToggle}
              style={styles.iconButton}
              testID="menu-button"
            >
              <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.accent} />
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
          <View style={dynamicStyles.menuContainer}>
            {conversation.type === 'group' && (
              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push(`/(tabs)/conversations/group-settings?id=${conversationId}`);
                }}
              >
                <Ionicons name="information-circle-outline" size={22} color={theme.colors.accent} />
                <Text style={dynamicStyles.menuItemText}>Group Info</Text>
              </TouchableOpacity>
            )}
            {conversation.type === 'direct' && (
              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setShowSettings(true);
                }}
              >
                <Ionicons name="settings-outline" size={22} color={theme.colors.accent} />
                <Text style={dynamicStyles.menuItemText}>Conversation Settings</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={dynamicStyles.menuItem} onPress={handleMuteToggle}>
              <Ionicons
                name={isMuted ? 'notifications' : 'notifications-off'}
                size={22}
                color={theme.colors.accent}
              />
              <Text style={dynamicStyles.menuItemText}>
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[dynamicStyles.menuItem, styles.menuItemLast]}
              onPress={() => setShowMenu(false)}
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              <Text style={[dynamicStyles.menuItemText, dynamicStyles.menuItemTextMuted]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Conversation Settings Modal (Story 5.4 - Task 13) */}
      {user && (
        <ConversationSettings
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          conversation={conversation}
          userId={user.uid}
        />
      )}

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
        keyboardVerticalOffset={0}
      >
        {messagesLoading ? (
          <View style={styles.messagesLoadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={dynamicStyles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            // Inverted list: newest messages at bottom (industry standard pattern)
            inverted={true}
            // Pagination: trigger when scrolled near the top (load older messages)
            // With inverted list, "end" is visually at the top
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.5}
            // Maintain scroll position during pagination (prevents jumping)
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            // Performance optimizations
            // NOTE: removeClippedSubviews disabled to ensure viewability callbacks fire for read receipts
            // NOTE: windowSize increased to ensure items stay mounted for viewability tracking
            // Trade-off: Slightly higher memory usage, but ensures read receipt tracking works correctly
            removeClippedSubviews={false}
            windowSize={21} // Increased from 10 to keep more items mounted
            maxToRenderPerBatch={20} // Increased from 10 to reduce batching delays
            updateCellsBatchingPeriod={50}
            initialNumToRender={30} // Increased from 20 to render more on initial load
            // Disable recycling optimizations that can interfere with viewability
            disableVirtualization={false} // Keep virtualization for performance
            // Read receipts viewport detection (AC1, AC8)
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            // Loading indicator at top when fetching older messages
            ListHeaderComponent={
              isLoadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={dynamicStyles.loadingMoreText}>Loading older messages...</Text>
                </View>
              ) : !hasMore && messages.length > 0 ? (
                <View style={styles.loadingMoreContainer}>
                  <Text style={dynamicStyles.endMessagesText}>No more messages</Text>
                </View>
              ) : null
            }
            // Empty state
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name={isSearching ? 'search-outline' : 'chatbubbles-outline'}
                  size={80}
                  color={theme.colors.textTertiary}
                />
                <Text style={dynamicStyles.emptyStateText}>
                  {isSearching ? 'No messages found' : 'No messages yet. Start the conversation!'}
                </Text>
              </View>
            }
          />
        )}

        {/* Typing Indicator - positioned above MessageInput */}
        {typingUsers.length > 0 && <TypingIndicator typingUsers={typingUsers} />}

        {/* Response Draft Card Modal (Story 6.2) */}
        {activeDraft && draftMessageId && (
          <ResponseDraftCard
            draft={activeDraft}
            conversationId={conversationId || ''}
            onSend={handleSendDraft}
            onDiscard={handleDiscardDraft}
            onPopulateInput={(text) => {
              setDraftTextToPopulate(text);
              // Reset after a brief delay to allow the effect to trigger
              setTimeout(() => setDraftTextToPopulate(undefined), 100);
            }}
            onRegenerateDraft={handleRegenerateDraft}
            isRegenerating={isRegeneratingDraft}
            visible={showDraftModal}
            onClose={handleCloseDraftModal}
          />
        )}

        {/* Message Input */}
        <MessageInput
          onSend={sendMessage}
          conversationId={conversationId || ''}
          userId={user?.uid || ''}
          disabled={!user}
          onGenerateDraft={() => {
            if (activeDraft) {
              // Reopen the modal with existing draft (instant, no loading)
              setShowDraftModal(true);
            } else {
              // Generate new draft for the most recent message from another user
              const lastOtherUserMessage = messages.find(m => m.senderId !== user?.uid);
              if (lastOtherUserMessage) {
                handleGenerateDraft(lastOtherUserMessage.id, true); // Pass true to open modal after generation
              }
            }
          }}
          isGeneratingDraft={isGeneratingDraft}
          canGenerateDraft={messages.length > 0}
          draftText={draftTextToPopulate}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
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
  loadingMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
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
  menuItemLast: {
    borderBottomWidth: 0,
  },
});
