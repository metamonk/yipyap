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
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      testID="faq-analytics"
    >
      {/* Overview Stats */}
      <View style={styles.statsGrid}>
        {/* Total Templates */}
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="document-text" size={24} color="#007AFF" />
          </View>
          <Text style={styles.statValue}>{analytics.totalTemplates}</Text>
          <Text style={styles.statLabel}>Total FAQs</Text>
          <Text style={styles.statSubtext}>
            {analytics.activeTemplates} active
          </Text>
        </View>

        {/* Auto-Responses */}
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="flash" size={24} color="#007AFF" />
          </View>
          <Text style={styles.statValue}>{analytics.totalAutoResponses}</Text>
          <Text style={styles.statLabel}>Auto-Responses</Text>
          <Text style={styles.statSubtext}>Sent automatically</Text>
        </View>
      </View>

      {/* Time Saved */}
      <View style={[styles.statCard, styles.fullWidthCard]}>
        <View style={styles.statHeader}>
          <View style={[styles.statIconContainer, styles.successIcon]}>
            <Ionicons name="time" size={24} color="#34C759" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{analytics.timeSavedMinutes} min</Text>
            <Text style={styles.statLabel}>Time Saved</Text>
            <Text style={styles.statSubtext}>
              ~{Math.round(analytics.timeSavedMinutes / 60)} hours of manual responses
            </Text>
          </View>
        </View>
      </View>

      {/* Top FAQs Section */}
      {analytics.topFAQs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top FAQs by Usage</Text>
          <View style={styles.list}>
            {analytics.topFAQs.map((faq, index) => (
              <View key={faq.id} style={styles.listItem} testID={`top-faq-${index}`}>
                <View style={styles.listItemLeft}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.listItemText}>
                    <Text style={styles.faqQuestion} numberOfLines={2}>
                      {faq.question}
                    </Text>
                    <Text style={styles.faqCategory}>{faq.category.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.usageCount}>
                  <Text style={styles.usageCountValue}>{faq.useCount}</Text>
                  <Text style={styles.usageCountLabel}>
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
          <Ionicons name="chatbubbles-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyStateTitle}>No FAQ usage yet</Text>
          <Text style={styles.emptyStateText}>
            Create FAQ templates and they'll automatically respond to matching messages.
          </Text>
        </View>
      )}

      {/* Usage by Category */}
      {Object.keys(analytics.usageByCategory).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage by Category</Text>
          <View style={styles.list}>
            {Object.entries(analytics.usageByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <View key={category} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{category.toUpperCase()}</Text>
                  <View style={styles.categoryCount}>
                    <Text style={styles.categoryCountValue}>{count}</Text>
                    <Text style={styles.categoryCountLabel}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: '#A8A8A8',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
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
    backgroundColor: '#007AFF',
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
    color: '#1C1C1E',
    lineHeight: 18,
  },
  faqCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 4,
  },
  usageCount: {
    alignItems: 'flex-end',
  },
  usageCountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  usageCountLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  categoryCount: {
    alignItems: 'flex-end',
  },
  categoryCountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  categoryCountLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
});
