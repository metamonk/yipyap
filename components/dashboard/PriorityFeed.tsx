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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

/**
 * PriorityFeed Component
 */
export function PriorityFeed({
  userId,
  maxResults = 20,
  onMessagePress,
  title = 'Priority Messages',
}: PriorityFeedProps) {
  const [messages, setMessages] = useState<PriorityMessageFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Ionicons name="checkmark-circle-outline" size={64} color="#9CA3AF" />
        <Text style={styles.emptyStateTitle}>No Priority Messages</Text>
        <Text style={styles.emptyStateDescription}>
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182CE" />
          <Text style={styles.loadingText}>Loading priority messages...</Text>
        </View>
      </View>
    );
  }

  /**
   * Render error state
   */
  if (error && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#E53E3E" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityRole="region" accessibilityLabel="Priority message feed">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {messages.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{messages.length}</Text>
          </View>
        )}
      </View>

      {/* Message List */}
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3182CE"
            colors={['#3182CE']}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  badge: {
    backgroundColor: '#3182CE',
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
    color: '#6B7280',
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
    color: '#E53E3E',
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
    color: '#4B5563',
  },
  emptyStateDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
