/**
 * Archived Conversations Screen
 *
 * @remarks
 * Displays all archived conversations for the current user.
 * Features real-time updates, pull-to-refresh, unarchive action, and empty state.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useAuth } from '@/hooks/useAuth';
import { ConversationListItem } from '@/components/conversation/ConversationListItem';
import {
  subscribeToArchivedConversations,
  archiveConversation as archiveConversationService,
} from '@/services/conversationService';
import { getUserProfile } from '@/services/userService';
import type { Conversation, User } from '@/types/models';

/**
 * Empty state component displayed when user has no archived conversations
 *
 * @component
 */
const EmptyState: React.FC = () => {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="archive-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No archived conversations</Text>
      <Text style={styles.emptySubtitle}>Archived conversations will appear here</Text>
    </View>
  );
};

/**
 * Archived Conversations Screen component
 *
 * @component
 *
 * @remarks
 * - Displays all archived conversations where user is a participant
 * - Sorted by most recent message timestamp
 * - Real-time updates via Firestore listener
 * - Pull-to-refresh functionality
 * - Swipe to unarchive
 * - Empty state when no archived conversations
 *
 * @example
 * Route: /conversations/archived
 */
export default function ArchivedConversationsScreen() {
  // Get current user from auth context
  const { user } = useAuth();
  const currentUserId = user?.uid || '';

  // State for conversations and loading
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store participant data
  const [participantData, setParticipantData] = useState<Record<string, User>>({});

  /**
   * Subscribe to archived conversations
   */
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      try {
        unsubscribe = subscribeToArchivedConversations(currentUserId, (archivedConvs) => {
          setConversations(archivedConvs);
          setLoading(false);
          setRefreshing(false);
          setError(null);
        });
      } catch (err) {
        console.error('Error subscribing to archived conversations:', err);
        setError('Failed to load archived conversations');
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUserId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, currentUserId]);

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
   * Handle unarchive action
   */
  const handleArchive = async (conversationId: string, archive: boolean) => {
    try {
      await archiveConversationService(conversationId, currentUserId, archive);
      // Conversation will automatically disappear from list via real-time listener
    } catch (err) {
      console.error('Error unarchiving conversation:', err);
      Alert.alert('Error', 'Failed to unarchive conversation. Please try again.');
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    // The real-time listener will update the data automatically
    // Just need to set refreshing to false after a brief moment
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    router.back();
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
        isArchived={true}
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
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Archived"
        leftAction={{
          icon: 'arrow-back',
          onPress: handleBack,
        }}
      />

      {/* Conversation List */}
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        // Empty state
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={conversations.length === 0 && styles.emptyListContent}
      />
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
    marginTop: 16,
    color: '#000000',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
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
});
