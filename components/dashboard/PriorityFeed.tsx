/**
 * PriorityFeed - Priority message feed component (Story 5.7 - Task 4)
 *
 * @remarks
 * Displays a feed of priority messages combining:
 * - Crisis messages (negative sentiment + urgent)
 * - High-value opportunities (score >= 70)
 * - Urgent messages
 *
 * Messages are sorted by priority score (crisis > high-value > urgent)
 * and then by timestamp (most recent first).
 *
 * @example
 * ```tsx
 * <PriorityFeed
 *   userId={currentUser.id}
 *   maxResults={20}
 *   onMessagePress={(conversationId) => router.push(`/conversations/${conversationId}`)}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { PriorityMessageCard } from './PriorityMessageCard';
import { dashboardService } from '@/services/dashboardService';
import type { PriorityMessageFeedItem } from '@/types/dashboard';

/**
 * Props for PriorityFeed component
 */
interface PriorityFeedProps {
  /** User ID to fetch priority messages for */
  userId: string;

  /** Maximum number of messages to display (default: 20) */
  maxResults?: number;

  /** Callback when a message card is pressed */
  onMessagePress: (conversationId: string) => void;

  /** Optional title (default: "Priority Messages") */
  title?: string;

  /** Preview mode - show only top 3 items (default: true) */
  previewMode?: boolean;

  /** Callback when "View All" is pressed (only in preview mode) */
  onViewAll?: () => void;

  /** Callback when messages are loaded (passes message count) */
  onMessagesLoaded?: (count: number) => void;
}

/**
 * PriorityFeed Component
 */
export function PriorityFeed({
  userId,
  maxResults = 20,
  onMessagePress,
  title = 'Priority Messages',
  previewMode = true,
  onViewAll,
  onMessagesLoaded,
}: PriorityFeedProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<PriorityMessageFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    badge: {
      backgroundColor: theme.colors.accent,
    },
    loadingText: {
      color: theme.colors.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    emptyStateTitle: {
      color: theme.colors.textPrimary,
    },
    emptyStateDescription: {
      color: theme.colors.textSecondary,
    },
    viewAllText: {
      color: theme.colors.accent,
    },
  });

  /**
   * Fetch priority messages from service
   */
  const fetchMessages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const priorityMessages = await dashboardService.getPriorityMessages(userId, maxResults);
      setMessages(priorityMessages);

      // Notify parent of message count
      if (onMessagesLoaded) {
        onMessagesLoaded(priorityMessages.length);
      }
    } catch (err) {
      console.error('Error fetching priority messages:', err);
      setError('Failed to load priority messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, maxResults]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    fetchMessages(true);
  }, [fetchMessages]);

  /**
   * Render individual message item
   */
  const renderItem = useCallback(
    ({ item }: { item: PriorityMessageFeedItem }) => (
      <PriorityMessageCard
        item={item}
        onPress={() => onMessagePress(item.conversationId)}
      />
    ),
    [onMessagePress]
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.textTertiary} />
        <Text style={[styles.emptyStateTitle, dynamicStyles.emptyStateTitle]}>No Priority Messages</Text>
        <Text style={[styles.emptyStateDescription, dynamicStyles.emptyStateDescription]}>
          You're all caught up! No urgent or high-value messages at the moment.
        </Text>
      </View>
    );
  };

  /**
   * Render loading state
   */
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading priority messages...</Text>
        </View>
      </View>
    );
  }

  /**
   * Render error state
   */
  if (error && !refreshing) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
        </View>
      </View>
    );
  }

  // Get preview or full list
  const displayMessages = previewMode ? messages.slice(0, 3) : messages;
  const hasMore = messages.length > 3;

  return (
    <View style={previewMode ? [styles.container, dynamicStyles.container] : styles.modalContainer} accessibilityRole="region" accessibilityLabel="Priority message feed">
      {/* Header */}
      {previewMode && (
        <View style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
          {messages.length > 0 && (
            <View style={[styles.badge, dynamicStyles.badge]}>
              <Text style={styles.badgeText}>{messages.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* Message List - Preview or Full */}
      {previewMode ? (
        <View style={styles.previewContainer}>
          {/* Preview List (no scrolling) */}
          {displayMessages.map((item) => (
            <PriorityMessageCard
              key={item.id}
              item={item}
              onPress={() => onMessagePress(item.conversationId)}
            />
          ))}

          {/* Empty State */}
          {displayMessages.length === 0 && !loading && renderEmptyState()}

          {/* View All Button */}
          {hasMore && onViewAll && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={onViewAll}
              accessibilityRole="button"
              accessibilityLabel={`View all ${messages.length} priority messages`}
            >
              <Text style={[styles.viewAllText, dynamicStyles.viewAllText]}>
                View All {messages.length} Messages
              </Text>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          contentContainerStyle={messages.length === 0 ? styles.emptyListContainer : styles.listContainer}
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
        />
      )}
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateDescription: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Preview mode styles
  previewContainer: {
    padding: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
