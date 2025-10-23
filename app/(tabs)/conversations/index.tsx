/**
 * Conversation List Screen
 *
 * @remarks
 * Main screen displaying all conversations for the current user.
 * Features real-time updates, pull-to-refresh, and empty state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { SearchBar } from '@/components/chat/SearchBar';
import { SearchResultItem } from '@/components/chat/SearchResultItem';
import { useConversations } from '@/hooks/useConversations';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useAuth } from '@/hooks/useAuth';
import { useAllConversationMessages } from '@/hooks/useAllConversationMessages';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { ConversationListItem } from '@/components/conversation/ConversationListItem';
import { getUserProfile } from '@/services/userService';
import {
  archiveConversation as archiveConversationService,
  deleteConversation as deleteConversationService,
  batchArchiveConversations,
  batchDeleteConversations,
} from '@/services/conversationService';
import type { Conversation, Message, SearchResult, User } from '@/types/models';

/**
 * Empty state component displayed when user has no conversations
 *
 * @component
 */
const EmptyState: React.FC = () => {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Start your first conversation</Text>
      <Text style={styles.emptySubtitle}>
        Tap the &quot;New Message&quot; button to find users and start chatting
      </Text>
    </View>
  );
};

/**
 * Conversation List Screen component
 *
 * @component
 *
 * @remarks
 * - Displays all conversations where user is a participant
 * - Sorted by most recent message timestamp
 * - Real-time updates via Firestore listener
 * - Pull-to-refresh functionality
 * - Optimized FlatList performance
 * - Empty state when no conversations
 *
 * @example
 * Route: /conversations
 */
export default function ConversationListScreen() {
  // Get current user from auth context
  const { user } = useAuth();
  const currentUserId = user?.uid || '';

  // Load conversations using custom hook
  const { conversations, loading, error, refresh, refreshing } = useConversations(currentUserId);

  // Network status hooks
  const { connectionStatus } = useNetworkStatus();
  const { lastSyncTime, isSyncing } = useOfflineSync();
  const isOffline = connectionStatus === 'offline';

  // Store participant data
  const [participantData, setParticipantData] = useState<Record<string, User>>({});

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);

  // Selection mode state (Story 4.7)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [isBatchOperationInProgress, setIsBatchOperationInProgress] = useState(false);

  // Get conversation IDs for loading messages
  // Memoize to prevent infinite re-renders in useAllConversationMessages
  const conversationIds = React.useMemo(
    () => conversations.map((conv) => conv.id),
    [conversations]
  );

  // Load messages from all conversations for search
  const { messages: allMessages, loading: messagesLoading } = useAllConversationMessages(
    conversationIds,
    searchEnabled
  );

  // Search functionality
  const { searchResults, isSearching, searchMessages, clearSearch } = useMessageSearch(allMessages);

  /**
   * Fetch participant data for all conversations
   */
  useEffect(() => {
    if (!currentUserId || conversations.length === 0) {
      return;
    }

    const fetchParticipants = async () => {
      try {
        // Get unique participant IDs (excluding current user) that we don't have data for
        const participantIds = new Set<string>();
        conversations.forEach((conv) => {
          conv.participantIds.forEach((id) => {
            if (id !== currentUserId) {
              participantIds.add(id);
            }
          });
        });

        // Check which ones we already have
        const missingIds = Array.from(participantIds).filter((id) => !participantData[id]);

        if (missingIds.length === 0) {
          return; // All data already fetched
        }

        // Fetch only missing user data
        const fetchedUsers: Record<string, User> = {};
        await Promise.all(
          missingIds.map(async (userId) => {
            try {
              const user = await getUserProfile(userId);
              if (user) {
                fetchedUsers[userId] = user;
              }
            } catch (err) {
              console.error(`Failed to fetch user ${userId}:`, err);
            }
          })
        );

        // Update state only if we fetched new data
        if (Object.keys(fetchedUsers).length > 0) {
          setParticipantData((prev) => ({
            ...prev,
            ...fetchedUsers,
          }));
        }
      } catch (err) {
        console.error('Error fetching participants:', err);
      }
    };

    fetchParticipants();
  }, [conversations, currentUserId]); // Removed participantData from deps

  /**
   * Get the other participant in a direct conversation
   */
  const getOtherParticipantId = (conversation: Conversation): string => {
    return conversation.participantIds.find((id) => id !== currentUserId) || currentUserId;
  };

  /**
   * Navigate to chat screen
   */
  const handleConversationPress = (conversationId: string) => {
    router.push(`/(tabs)/conversations/${conversationId}`);
  };

  /**
   * Navigate to new conversation screen
   */
  const handleNewConversation = () => {
    // Prevent creating new conversations when offline
    if (isOffline) {
      return;
    }

    // Navigate to unified new conversation screen
    router.push('/(tabs)/conversations/new');
  };

  /**
   * Navigate to archived conversations screen
   */
  const handleArchivedPress = () => {
    router.push('/(tabs)/conversations/archived');
  };

  /**
   * Handle archive action
   */
  const handleArchive = async (conversationId: string, archive: boolean) => {
    try {
      await archiveConversationService(conversationId, currentUserId, archive);
      // Conversation will automatically disappear from list via real-time listener
    } catch (err) {
      console.error('Error archiving conversation:', err);
      Alert.alert('Error', 'Failed to archive conversation. Please try again.');
    }
  };

  /**
   * Handle delete action with confirmation dialog
   */
  const handleDelete = async (conversationId: string) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversationService(conversationId, currentUserId);
              // Conversation will automatically disappear from list via real-time listener
            } catch (err) {
              console.error('Error deleting conversation:', err);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  };

  /**
   * Enter selection mode with the specified conversation initially selected
   */
  const enterSelectionMode = (conversationId: string) => {
    setIsSelectionMode(true);
    setSelectedConversationIds(new Set([conversationId]));
  };

  /**
   * Exit selection mode and clear all selections
   */
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedConversationIds(new Set());
  };

  /**
   * Toggle selection state for the specified conversation
   */
  const toggleSelection = (conversationId: string) => {
    setSelectedConversationIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  };

  /**
   * Select all conversations in the list (optional enhancement)
   */
  const selectAll = () => {
    const allIds = new Set(conversations.map((conv) => conv.id));
    setSelectedConversationIds(allIds);
  };

  /**
   * Handle batch archive action (Story 4.7 - Task 7)
   * Archives multiple conversations with optimistic UI update
   */
  const handleBatchArchive = async () => {
    const conversationIdsToArchive = Array.from(selectedConversationIds);
    const count = conversationIdsToArchive.length;

    if (count === 0) {
      return;
    }

    setIsBatchOperationInProgress(true);

    try {
      // Call batch archive service
      await batchArchiveConversations(conversationIdsToArchive, currentUserId, true);

      // Show success feedback
      Alert.alert('Success', `${count} conversation${count > 1 ? 's' : ''} archived successfully`);

      // Exit selection mode
      exitSelectionMode();
    } catch (err) {
      console.error('Error batch archiving conversations:', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to archive conversations. Please try again.'
      );
    } finally {
      setIsBatchOperationInProgress(false);
    }
  };

  /**
   * Handle batch delete action (Story 4.7 - Task 8)
   * Deletes multiple conversations with confirmation dialog
   */
  const handleBatchDelete = async () => {
    const conversationIdsToDelete = Array.from(selectedConversationIds);
    const count = conversationIdsToDelete.length;

    if (count === 0) {
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      `Delete ${count} Conversation${count > 1 ? 's' : ''}`,
      `Are you sure you want to delete ${count} conversation${count > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsBatchOperationInProgress(true);

            try {
              // Call batch delete service
              await batchDeleteConversations(conversationIdsToDelete, currentUserId);

              // Show success feedback
              Alert.alert(
                'Success',
                `${count} conversation${count > 1 ? 's' : ''} deleted successfully`
              );

              // Exit selection mode
              exitSelectionMode();
            } catch (err) {
              console.error('Error batch deleting conversations:', err);
              Alert.alert(
                'Error',
                err instanceof Error
                  ? err.message
                  : 'Failed to delete conversations. Please try again.'
              );
            } finally {
              setIsBatchOperationInProgress(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle back button press (Story 4.7 - Task 9)
   * Exit selection mode when back is pressed while in selection mode
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isSelectionMode) {
          exitSelectionMode();
          return true; // Prevent default back navigation
        }
        return false; // Allow default back navigation
      });

      return () => backHandler.remove();
    }
  }, [isSelectionMode]);

  /**
   * Auto-exit selection mode when all conversations are gone (Story 4.7 - Task 12)
   * This handles edge case where selected conversations disappear from list
   */
  useEffect(() => {
    if (isSelectionMode && conversations.length === 0) {
      exitSelectionMode();
    }
  }, [isSelectionMode, conversations.length]);

  /**
   * Remove deleted/archived conversations from selection (Story 4.7 - Task 12)
   * Ensures selectedConversationIds only contains valid conversation IDs
   */
  useEffect(() => {
    if (isSelectionMode && selectedConversationIds.size > 0) {
      const currentConversationIds = new Set(conversations.map((c) => c.id));
      const validSelectedIds = Array.from(selectedConversationIds).filter((id) =>
        currentConversationIds.has(id)
      );

      // If some selections are no longer valid, update the selection
      if (validSelectedIds.length !== selectedConversationIds.size) {
        if (validSelectedIds.length === 0) {
          // All selected conversations disappeared, exit selection mode
          exitSelectionMode();
        } else {
          // Some conversations disappeared, update selection
          setSelectedConversationIds(new Set(validSelectedIds));
        }
      }
    }
  }, [isSelectionMode, conversations, selectedConversationIds]);

  /**
   * Toggle search mode
   */
  const handleSearchToggle = () => {
    const newShowSearch = !showSearch;
    setShowSearch(newShowSearch);

    if (newShowSearch) {
      // Enable message loading when opening search
      setSearchEnabled(true);
    } else {
      // Clear search when closing
      clearSearch();
    }
  };

  /**
   * Handle search query change
   */
  const handleSearch = useCallback(
    (query: string) => {
      searchMessages(query);
    },
    [searchMessages]
  );

  /**
   * Handle clear search
   */
  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  /**
   * Navigate to specific message in conversation
   */
  const handleSearchResultPress = (message: Message) => {
    // Navigate to the conversation containing this message
    router.push(`/(tabs)/conversations/${message.conversationId}?messageId=${message.id}`);
  };

  /**
   * Build search results with conversation context
   */
  const buildSearchResults = (): SearchResult[] => {
    return searchResults.map((message) => {
      const conversation = conversations.find((c) => c.id === message.conversationId);

      if (!conversation) {
        return {
          message,
          conversationId: message.conversationId,
          conversationName: 'Unknown Conversation',
          senderName: 'Unknown Sender',
        };
      }

      // Get sender info
      const sender = participantData[message.senderId];
      const senderName = sender?.displayName || 'Unknown Sender';
      const senderPhotoURL = sender?.photoURL || undefined;

      // Get conversation name
      let conversationName: string;
      if (conversation.type === 'group') {
        conversationName = conversation.groupName || 'Group Chat';
      } else {
        const otherParticipantId = getOtherParticipantId(conversation);
        const otherParticipant = participantData[otherParticipantId];
        conversationName = otherParticipant?.displayName || 'Unknown User';
      }

      return {
        message,
        conversationId: conversation.id,
        conversationName,
        senderName,
        senderPhotoURL,
      };
    });
  };

  /**
   * Render a single conversation item
   */
  const renderItem = ({ item }: { item: Conversation }) => {
    const otherParticipantId = getOtherParticipantId(item);
    const otherParticipant = participantData[otherParticipantId];

    // Use group name for group chats, participant name for direct chats
    const displayName =
      item.type === 'group'
        ? item.groupName || 'Group Chat'
        : otherParticipant?.displayName || 'Unknown User';

    const photoURL =
      item.type === 'group' ? item.groupPhotoURL || null : otherParticipant?.photoURL || null;

    return (
      <ConversationListItem
        conversation={item}
        currentUserId={currentUserId}
        otherParticipantName={displayName}
        otherParticipantPhoto={photoURL}
        otherParticipantId={item.type === 'direct' ? otherParticipantId : undefined}
        onPress={handleConversationPress}
        onArchive={handleArchive}
        onDelete={handleDelete}
        // Selection mode props (Story 4.7)
        isSelectionMode={isSelectionMode}
        isSelected={selectedConversationIds.has(item.id)}
        onLongPress={() => enterSelectionMode(item.id)}
        onToggleSelect={() => toggleSelection(item.id)}
      />
    );
  };

  /**
   * Key extractor for FlatList
   */
  const keyExtractor = (item: Conversation) => item.id;

  // Show loading spinner on initial load or when no user is authenticated

  if ((loading && !refreshing) || !currentUserId) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Show error message
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build search results with context
  const searchResultsWithContext = buildSearchResults();

  return (
    <View style={styles.container}>
      {/* Header: Normal mode vs Selection mode (Story 4.7) */}
      {isSelectionMode ? (
        <NavigationHeader
          title={`${selectedConversationIds.size} selected`}
          leftAction={{
            label: 'Cancel',
            onPress: exitSelectionMode,
          }}
          rightAction={
            selectedConversationIds.size > 0
              ? {
                  label: 'Select All',
                  onPress: selectAll,
                }
              : undefined
          }
        />
      ) : (
        <NavigationHeader
          title="Messages"
          rightAction={{
            label: '+ New',
            onPress: handleNewConversation,
          }}
          leftAction={{
            icon: showSearch ? 'close' : 'search',
            onPress: handleSearchToggle,
          }}
        />
      )}

      {/* Search Bar (conditionally shown) */}
      {showSearch && (
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search all messages..."
          testID="conversation-list-search-bar"
        />
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            {isSyncing
              ? 'Syncing messages...'
              : lastSyncTime
                ? `Last synced: ${lastSyncTime.toLocaleTimeString()}`
                : 'Viewing cached conversations'}
          </Text>
        </View>
      )}

      {/* Archived Link (shown when not searching) */}
      {!showSearch && (
        <TouchableOpacity style={styles.archivedLink} onPress={handleArchivedPress}>
          <Ionicons name="archive-outline" size={20} color="#007AFF" />
          <Text style={styles.archivedLinkText}>Archived</Text>
        </TouchableOpacity>
      )}

      {/* Search Results or Conversation List */}
      {showSearch && isSearching ? (
        // Show search results
        messagesLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Searching messages...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResultsWithContext}
            renderItem={({ item }) => (
              <SearchResultItem
                message={item.message}
                conversationName={item.conversationName}
                senderName={item.senderName}
                senderPhotoURL={item.senderPhotoURL}
                onPress={() => handleSearchResultPress(item.message)}
                testID={`search-result-${item.message.id}`}
              />
            )}
            keyExtractor={(item) => item.message.id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyTitle}>No messages found</Text>
                <Text style={styles.emptySubtitle}>Try searching with different keywords</Text>
              </View>
            }
            contentContainerStyle={searchResultsWithContext.length === 0 && styles.emptyListContent}
          />
        )
      ) : (
        // Show conversation list
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
          // Pull to refresh
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#007AFF" />
          }
          // Empty state
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={conversations.length === 0 && styles.emptyListContent}
        />
      )}

      {/* Bottom Action Bar (Story 4.7) - shown in selection mode */}
      {isSelectionMode && (
        <View style={styles.bottomActionBar}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.archiveButton,
              (selectedConversationIds.size === 0 || isBatchOperationInProgress) &&
                styles.disabledButton,
            ]}
            onPress={handleBatchArchive}
            disabled={selectedConversationIds.size === 0 || isBatchOperationInProgress}
            activeOpacity={0.7}
          >
            {isBatchOperationInProgress ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="archive-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  Archive ({selectedConversationIds.size})
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.deleteButton,
              (selectedConversationIds.size === 0 || isBatchOperationInProgress) &&
                styles.disabledButton,
            ]}
            onPress={handleBatchDelete}
            disabled={selectedConversationIds.size === 0 || isBatchOperationInProgress}
            activeOpacity={0.7}
          >
            {isBatchOperationInProgress ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Delete ({selectedConversationIds.size})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: '#FFF3CD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  offlineText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  archivedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  archivedLinkText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  bottomActionBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  archiveButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
