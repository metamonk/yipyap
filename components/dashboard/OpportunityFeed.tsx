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
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
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

  /** Preview mode - show only top 3 items (default: true) */
  previewMode?: boolean;

  /** Callback when "View All" is pressed (only in preview mode) */
  onViewAll?: () => void;
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
  previewMode = true,
  onViewAll,
}: OpportunityFeedProps) {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    loadingText: {
      color: theme.colors.textSecondary,
    },
    emptyText: {
      color: theme.colors.textPrimary,
    },
    emptySubtext: {
      color: theme.colors.textSecondary,
    },
    viewAllText: {
      color: theme.colors.accent,
    },
  });

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
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading opportunities...</Text>
      </View>
    );
  }

  // Render empty state
  if (!loading && opportunities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={[styles.emptyText, dynamicStyles.emptyText]}>{emptyMessage}</Text>
        <Text style={[styles.emptySubtext, dynamicStyles.emptySubtext]}>
          New business opportunities will appear here when detected
        </Text>
      </View>
    );
  }

  // Get preview or full list
  const displayOpportunities = previewMode ? opportunities.slice(0, 3) : opportunities;
  const hasMore = opportunities.length > 3;

  return previewMode ? (
    <View style={styles.previewContainer}>
      {/* Preview List (no scrolling) */}
      {displayOpportunities.map((item) => (
        <OpportunityCard key={item.id} message={item} animated={newOpportunityIds.has(item.id)} />
      ))}

      {/* View All Button */}
      {hasMore && onViewAll && (
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={onViewAll}
          accessibilityRole="button"
          accessibilityLabel={`View all ${opportunities.length} opportunities`}
        >
          <Text style={[styles.viewAllText, dynamicStyles.viewAllText]}>
            View All {opportunities.length} Opportunities
          </Text>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  ) : (
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
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
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

// Static layout styles (theme-aware colors are in dynamicStyles)
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
    fontSize: 14,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
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
