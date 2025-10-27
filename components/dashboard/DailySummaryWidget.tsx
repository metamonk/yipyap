/**
 * DailySummaryWidget - Meaningful 10 daily digest summary widget (Story 6.1)
 *
 * @remarks
 * Displays priority-tiered digest summary focusing on top 10 most important messages:
 * - High Priority (top 3): Respond today
 * - Medium Priority (2-7): Respond this week
 * - Auto-handled: FAQ + archived conversations
 * - Capacity tracking and time estimates
 *
 * Replaces old "Overnight Summary" with relationship-based prioritization (Epic 6).
 *
 * @example
 * ```tsx
 * <DailySummaryWidget
 *   loading={false}
 *   error={null}
 *   onRefresh={() => fetchData()}
 *   onViewDetails={() => router.push('/(tabs)/daily-digest')}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getMeaningful10Digest } from '@/services/dailyDigestService';
import { getFirebaseAuth } from '@/services/firebase';
import type { Meaningful10Digest } from '@/types/ai';

/**
 * Props for DailySummaryWidget component
 */
interface DailySummaryWidgetProps {
  /** Loading state */
  loading?: boolean;

  /** Error message if data fetch failed */
  error?: string | null;

  /** Optional title (default: "Your Meaningful 10 Today") */
  title?: string;

  /** Callback when refresh button is pressed */
  onRefresh?: () => void;

  /** Callback when "View Details" is tapped */
  onViewDetails?: () => void;
}

/**
 * DailySummaryWidget Component
 */
export function DailySummaryWidget({
  loading: externalLoading = false,
  error: externalError = null,
  title = 'Your Meaningful 10 Today',
  onRefresh,
  onViewDetails,
}: DailySummaryWidgetProps) {
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const [digest, setDigest] = useState<Meaningful10Digest | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);

  const loading = externalLoading || internalLoading;
  const error = externalError || internalError;

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
    loadingText: {
      color: theme.colors.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    retryButton: {
      backgroundColor: theme.colors.accent,
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
    emptyHint: {
      color: theme.colors.textTertiary,
    },
    priorityCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderColor: theme.colors.borderLight,
    },
    priorityCount: {
      color: theme.colors.textPrimary,
    },
    priorityLabel: {
      color: theme.colors.textSecondary,
    },
    prioritySubtext: {
      color: theme.colors.textTertiary,
    },
    capacityText: {
      color: theme.colors.textSecondary,
    },
    viewDetailsText: {
      color: theme.colors.accent,
    },
  });

  /**
   * Fetch Meaningful 10 digest on mount
   */
  useEffect(() => {
    async function fetchDigest() {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setInternalError('User not authenticated');
        setInternalLoading(false);
        return;
      }

      try {
        setInternalLoading(true);
        const meaningful10 = await getMeaningful10Digest(currentUser.uid);
        setDigest(meaningful10);
        setInternalError(null);
      } catch (err) {
        console.error('Error fetching Meaningful 10 digest:', err);
        setInternalError('Failed to load digest');
      } finally {
        setInternalLoading(false);
      }
    }

    fetchDigest();
  }, [auth]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading overnight summary...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
          {onRefresh && (
            <TouchableOpacity
              style={[styles.retryButton, dynamicStyles.retryButton]}
              onPress={onRefresh}
              accessibilityLabel="Retry loading dashboard"
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Empty state (no digest)
  if (!digest) {
    return (
      <View style={[styles.container, dynamicStyles.container]} accessibilityLabel="Daily summary widget">
        <View style={styles.titleRow}>
          <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No digest available yet</Text>
          <Text style={[styles.emptyHint, dynamicStyles.emptyHint]}>Check back later or refresh</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]} accessibilityLabel="Meaningful 10 summary widget">
      {/* Title Row with Refresh */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            accessibilityLabel="Refresh digest data"
            accessibilityRole="button"
            style={styles.refreshButton}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Priority Summary Cards - Simplified minimal design */}
      <View style={styles.priorityCardsRow}>
        {/* High Priority */}
        <View style={[styles.priorityCard, dynamicStyles.priorityCard]}>
          <Text style={[styles.priorityCount, dynamicStyles.priorityCount]}>{digest.highPriority.length}</Text>
          <Text style={[styles.priorityLabel, dynamicStyles.priorityLabel]}>High</Text>
          <Text style={[styles.prioritySubtext, dynamicStyles.prioritySubtext]}>Today</Text>
        </View>

        {/* Medium Priority */}
        <View style={[styles.priorityCard, dynamicStyles.priorityCard]}>
          <Text style={[styles.priorityCount, dynamicStyles.priorityCount]}>{digest.mediumPriority.length}</Text>
          <Text style={[styles.priorityLabel, dynamicStyles.priorityLabel]}>Medium</Text>
          <Text style={[styles.prioritySubtext, dynamicStyles.prioritySubtext]}>This week</Text>
        </View>

        {/* Auto-Handled */}
        <View style={[styles.priorityCard, dynamicStyles.priorityCard]}>
          <Text style={[styles.priorityCount, dynamicStyles.priorityCount]}>{digest.autoHandled.total}</Text>
          <Text style={[styles.priorityLabel, dynamicStyles.priorityLabel]}>Auto</Text>
          <Text style={[styles.prioritySubtext, dynamicStyles.prioritySubtext]}>Handled</Text>
        </View>
      </View>

      {/* Capacity & Time Summary - Simplified */}
      <View style={styles.capacityRow}>
        <View style={styles.capacityItem}>
          <Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.success || theme.colors.accent} />
          <Text style={[styles.capacityText, dynamicStyles.capacityText]}>{digest.capacityUsed} handled</Text>
        </View>
        <View style={styles.capacityItem}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.capacityText, dynamicStyles.capacityText]}>~{digest.estimatedTimeCommitment} min</Text>
        </View>
      </View>

      {/* View Details Button - Minimal text-only design */}
      {onViewDetails && (
        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={onViewDetails}
          accessibilityLabel="View full daily digest"
          accessibilityRole="button"
        >
          <Text style={[styles.viewDetailsText, dynamicStyles.viewDetailsText]}>View Full Digest</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Removed old CategoryBadge and SentimentBadge components (Epic 5 → Epic 6 migration)

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  // Container
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },

  // Loading state
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  // Error state
  errorContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Empty state
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 12,
  },

  // Title row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 4,
  },

  // Priority Cards Row - Minimal clean design
  priorityCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  priorityCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityCount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prioritySubtext: {
    fontSize: 10,
  },

  // Capacity Row - Simplified, no borders
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 16,
  },
  capacityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // View Details Button - Minimal text-only design
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
