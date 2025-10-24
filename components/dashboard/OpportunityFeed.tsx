/**
 * OpportunityFeed - Scrollable feed of business opportunities (Story 5.6)
 *
 * @remarks
 * Displays opportunities in chronological order with pull-to-refresh.
 * Uses FlatList for optimal performance with large lists.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { OpportunityCard } from './OpportunityCard';
import type { Message } from '@/types/models';

/**
 * Props for OpportunityFeed component
 */
interface OpportunityFeedProps {
  /** Array of opportunity messages to display */
  opportunities: Message[];

  /** Callback when user pulls to refresh */
  onRefresh?: () => Promise<void>;

  /** Whether feed is currently loading */
  loading?: boolean;

  /** Empty state message (optional) */
  emptyMessage?: string;

  /** Set of opportunity IDs that should be animated (Story 5.6 - Task 13.4) */
  newOpportunityIds?: Set<string>;
}

/**
 * OpportunityFeed Component
 *
 * @example
 * ```tsx
 * <OpportunityFeed
 *   opportunities={opportunities}
 *   onRefresh={fetchOpportunities}
 *   loading={isLoading}
 * />
 * ```
 */
export function OpportunityFeed({
  opportunities,
  onRefresh,
  loading = false,
  emptyMessage = 'No business opportunities yet',
  newOpportunityIds = new Set(),
}: OpportunityFeedProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh opportunities:', error);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Render loading state
  if (loading && opportunities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading opportunities...</Text>
      </View>
    );
  }

  // Render empty state
  if (!loading && opportunities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
        <Text style={styles.emptySubtext}>
          New business opportunities will appear here when detected
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={opportunities}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <OpportunityCard message={item} animated={newOpportunityIds.has(item.id)} />
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      updateCellsBatchingPeriod={50}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 280,
  },
});
