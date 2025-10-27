/**
 * FAQAnalytics component for displaying FAQ performance metrics
 *
 * @remarks
 * Displays comprehensive analytics about FAQ usage including:
 * - Total templates and active count
 * - Auto-responses sent
 * - Time saved estimate
 * - Top FAQs by usage
 * - Usage breakdown by category
 *
 * @module components/faq/FAQAnalytics
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { FAQAnalytics as FAQAnalyticsData } from '@/types/faq';

/**
 * Props for the FAQAnalytics component
 */
export interface FAQAnalyticsProps {
  /** Analytics data to display */
  analytics: FAQAnalyticsData;
}

/**
 * Displays FAQ performance analytics and metrics
 *
 * @component
 *
 * @remarks
 * - Shows key performance indicators in stat cards
 * - Displays top 10 FAQs by usage count
 * - Shows usage breakdown by category
 * - Provides visual feedback with icons and colors
 *
 * Design:
 * - Stat cards with white background and shadow
 * - Icons from Ionicons for visual interest
 * - Blue accents for primary metrics
 * - Green for time saved (positive value)
 * - List items with clean typography
 *
 * @example
 * ```tsx
 * <FAQAnalytics analytics={analyticsData} />
 * ```
 *
 * @param props - Component props
 * @returns FAQAnalytics component
 */
export const FAQAnalytics: FC<FAQAnalyticsProps> = ({ analytics }) => {
  const { theme } = useTheme();

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    subtitle: {
      color: theme.colors.textSecondary,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginTop: 8,
    },
    statCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    statValue: {
      color: theme.colors.textPrimary,
    },
    statLabel: {
      color: theme.colors.textSecondary,
    },
    statSubtext: {
      color: theme.colors.textTertiary || theme.colors.textSecondary,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
    },
    list: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    listItemBorder: {
      borderBottomColor: theme.colors.borderLight,
    },
    rankBadge: {
      backgroundColor: theme.colors.accent,
    },
    faqQuestion: {
      color: theme.colors.textPrimary,
    },
    faqCategory: {
      color: theme.colors.textSecondary,
    },
    usageCountValue: {
      color: theme.colors.accent,
    },
    usageCountLabel: {
      color: theme.colors.textSecondary,
    },
    categoryName: {
      color: theme.colors.textPrimary,
    },
    categoryCountValue: {
      color: theme.colors.accent,
    },
    categoryCountLabel: {
      color: theme.colors.textSecondary,
    },
    emptyStateIcon: {
      color: theme.colors.disabled || '#C7C7CC',
    },
    emptyStateTitle: {
      color: theme.colors.textPrimary,
    },
    emptyStateText: {
      color: theme.colors.textSecondary,
    },
  });

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      showsVerticalScrollIndicator={false}
      testID="faq-analytics"
    >
      {/* Page Header */}
      <Text style={[styles.title, dynamicStyles.title]}>FAQ Analytics</Text>
      <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
        Track FAQ performance, usage patterns, and time saved through automation
      </Text>

      {/* Overview Stats */}
      <Text style={dynamicStyles.sectionHeader}>OVERVIEW</Text>
      <View style={styles.statsGrid}>
        {/* Total Templates */}
        <View style={[styles.statCard, dynamicStyles.statCard]}>
          <View style={styles.statIconContainer}>
            <Ionicons name="document-text" size={24} color={theme.colors.accent} />
          </View>
          <Text style={[styles.statValue, dynamicStyles.statValue]}>{analytics.totalTemplates}</Text>
          <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Total FAQs</Text>
          <Text style={[styles.statSubtext, dynamicStyles.statSubtext]}>
            {analytics.activeTemplates} active
          </Text>
        </View>

        {/* Auto-Responses */}
        <View style={[styles.statCard, dynamicStyles.statCard]}>
          <View style={styles.statIconContainer}>
            <Ionicons name="flash" size={24} color={theme.colors.accent} />
          </View>
          <Text style={[styles.statValue, dynamicStyles.statValue]}>{analytics.totalAutoResponses}</Text>
          <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Auto-Responses</Text>
          <Text style={[styles.statSubtext, dynamicStyles.statSubtext]}>Sent automatically</Text>
        </View>
      </View>

      {/* Time Saved */}
      <View style={[styles.statCard, dynamicStyles.statCard, styles.fullWidthCard]}>
        <View style={styles.statHeader}>
          <View style={[styles.statIconContainer, styles.successIcon]}>
            <Ionicons name="time" size={24} color={theme.colors.success || '#34C759'} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={[styles.statValue, dynamicStyles.statValue]}>{analytics.timeSavedMinutes} min</Text>
            <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Time Saved</Text>
            <Text style={[styles.statSubtext, dynamicStyles.statSubtext]}>
              ~{Math.round(analytics.timeSavedMinutes / 60)} hours of manual responses
            </Text>
          </View>
        </View>
      </View>

      {/* Top FAQs Section */}
      {analytics.topFAQs.length > 0 && (
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionHeader}>TOP FAQs</Text>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Most Used Questions</Text>
          <View style={[styles.list, dynamicStyles.list]}>
            {analytics.topFAQs.map((faq, index) => (
              <View key={faq.id} style={[styles.listItem, dynamicStyles.listItemBorder]} testID={`top-faq-${index}`}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.rankBadge, dynamicStyles.rankBadge]}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.listItemText}>
                    <Text style={[styles.faqQuestion, dynamicStyles.faqQuestion]} numberOfLines={2}>
                      {faq.question}
                    </Text>
                    <Text style={[styles.faqCategory, dynamicStyles.faqCategory]}>{faq.category.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.usageCount}>
                  <Text style={[styles.usageCountValue, dynamicStyles.usageCountValue]}>{faq.useCount}</Text>
                  <Text style={[styles.usageCountLabel, dynamicStyles.usageCountLabel]}>
                    {faq.useCount === 1 ? 'use' : 'uses'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Empty State */}
      {analytics.topFAQs.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={dynamicStyles.emptyStateIcon.color} />
          <Text style={[styles.emptyStateTitle, dynamicStyles.emptyStateTitle]}>No FAQ usage yet</Text>
          <Text style={[styles.emptyStateText, dynamicStyles.emptyStateText]}>
            Create FAQ templates and they'll automatically respond to matching messages.
          </Text>
        </View>
      )}

      {/* Usage by Category */}
      {Object.keys(analytics.usageByCategory).length > 0 && (
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionHeader}>CATEGORY BREAKDOWN</Text>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Usage by Category</Text>
          <View style={[styles.list, dynamicStyles.list]}>
            {Object.entries(analytics.usageByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <View key={category} style={[styles.categoryItem, dynamicStyles.listItemBorder]}>
                  <Text style={[styles.categoryName, dynamicStyles.categoryName]}>{category.toUpperCase()}</Text>
                  <View style={styles.categoryCount}>
                    <Text style={[styles.categoryCountValue, dynamicStyles.categoryCountValue]}>{count}</Text>
                    <Text style={[styles.categoryCountLabel, dynamicStyles.categoryCountLabel]}>
                      {count === 1 ? 'use' : 'uses'}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  fullWidthCard: {
    marginBottom: 16,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successIcon: {
    backgroundColor: '#E8F5E9',
    marginBottom: 0,
    marginRight: 16,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listItemText: {
    flex: 1,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  faqCategory: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  usageCount: {
    alignItems: 'flex-end',
  },
  usageCountValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  usageCountLabel: {
    fontSize: 11,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryCount: {
    alignItems: 'flex-end',
  },
  categoryCountValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryCountLabel: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
});
