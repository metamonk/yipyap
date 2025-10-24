/**
 * DailySummaryWidget - Comprehensive overnight activity summary widget (Story 5.7)
 *
 * @remarks
 * Displays overnight activity metrics from all AI features:
 * - Message categorization (Story 5.2)
 * - Sentiment analysis and crisis detection (Story 5.3)
 * - FAQ detection and auto-responses (Story 5.4)
 * - Voice-matched suggestions (Story 5.5)
 * - Business opportunity scoring (Story 5.6)
 *
 * Shows total messages, category breakdown, sentiment trends, opportunities,
 * FAQ metrics, and comparison with previous day.
 *
 * @example
 * ```tsx
 * <DailySummaryWidget
 *   summary={dashboardSummary}
 *   loading={false}
 *   error={null}
 *   onRefresh={() => fetchData()}
 * />
 * ```
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DashboardSummary } from '@/types/dashboard';

/**
 * Props for DailySummaryWidget component
 */
interface DailySummaryWidgetProps {
  /** Dashboard summary with all overnight metrics */
  summary: DashboardSummary;

  /** Loading state */
  loading?: boolean;

  /** Error message if data fetch failed */
  error?: string | null;

  /** Optional title (default: "Overnight Summary") */
  title?: string;

  /** Callback when refresh button is pressed */
  onRefresh?: () => void;
}

/**
 * DailySummaryWidget Component
 */
export function DailySummaryWidget({
  summary,
  loading = false,
  error = null,
  title = 'Overnight Summary',
  onRefresh,
}: DailySummaryWidgetProps) {
  const [showCategoryDetails, setShowCategoryDetails] = useState(false);

  const { messagingMetrics, sentimentMetrics, faqMetrics, comparisonWithPrevious } = summary;

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182CE" />
          <Text style={styles.loadingText}>Loading overnight summary...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#E53E3E" />
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh && (
            <TouchableOpacity
              style={styles.retryButton}
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

  return (
    <View style={styles.container} accessibilityRole="region" accessibilityLabel="Daily summary widget">
      {/* Title Row with Refresh */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            accessibilityLabel="Refresh dashboard data"
            accessibilityRole="button"
            style={styles.refreshButton}
          >
            <Ionicons name="refresh-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Stats Row */}
      <View style={styles.mainStatsRow}>
        {/* Total Messages */}
        <View style={styles.statCard}>
          <Text style={styles.statValue} accessibilityLabel={`${messagingMetrics.totalMessages} messages`}>
            {messagingMetrics.totalMessages}
          </Text>
          <Text style={styles.statLabel}>Messages</Text>
          {comparisonWithPrevious.messageCountChange !== 0 && (
            <View style={styles.changeIndicator}>
              <Ionicons
                name={comparisonWithPrevious.messageCountChange >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={comparisonWithPrevious.messageCountChange >= 0 ? '#38A169' : '#E53E3E'}
              />
              <Text
                style={[
                  styles.changeText,
                  {
                    color: comparisonWithPrevious.messageCountChange >= 0 ? '#38A169' : '#E53E3E',
                  },
                ]}
              >
                {Math.abs(comparisonWithPrevious.messageCountChange).toFixed(0)}%
              </Text>
            </View>
          )}
        </View>

        {/* High-Value Opportunities */}
        <View style={[styles.statCard, styles.opportunityCard]}>
          <Text style={[styles.statValue, styles.opportunityValue]} accessibilityLabel={`${messagingMetrics.highValueOpportunities} high-value opportunities`}>
            {messagingMetrics.highValueOpportunities}
          </Text>
          <Text style={styles.statLabel}>Opportunities</Text>
          {comparisonWithPrevious.opportunityCountChange !== 0 && (
            <View style={styles.changeIndicator}>
              <Ionicons
                name={comparisonWithPrevious.opportunityCountChange >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color="#38A169"
              />
              <Text style={[styles.changeText, { color: '#38A169' }]}>
                {Math.abs(comparisonWithPrevious.opportunityCountChange).toFixed(0)}%
              </Text>
            </View>
          )}
        </View>

        {/* Crisis Messages */}
        {messagingMetrics.crisisMessages > 0 && (
          <View style={[styles.statCard, styles.crisisCard]}>
            <Text style={[styles.statValue, styles.crisisValue]} accessibilityLabel={`${messagingMetrics.crisisMessages} crisis messages requiring immediate attention`}>
              {messagingMetrics.crisisMessages}
            </Text>
            <Text style={styles.statLabel}>Crisis</Text>
            <Ionicons name="alert-circle" size={16} color="#E53E3E" style={styles.crisisIcon} />
          </View>
        )}
      </View>

      {/* Category Breakdown Section */}
      <View style={styles.categorySection}>
        <TouchableOpacity
          style={styles.categorySectionHeader}
          onPress={() => setShowCategoryDetails(!showCategoryDetails)}
          accessibilityLabel={showCategoryDetails ? 'Hide category breakdown' : 'Show category breakdown'}
          accessibilityRole="button"
        >
          <Text style={styles.sectionTitle}>Categories</Text>
          <Ionicons
            name={showCategoryDetails ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>

        {showCategoryDetails && (
          <View style={styles.categoryGrid}>
            <CategoryBadge label="Fan" count={messagingMetrics.byCategory.fan_engagement} color="#3182CE" />
            <CategoryBadge label="Business" count={messagingMetrics.byCategory.business_opportunity} color="#38A169" />
            <CategoryBadge label="Urgent" count={messagingMetrics.byCategory.urgent} color="#DD6B20" />
            <CategoryBadge label="Spam" count={messagingMetrics.byCategory.spam} color="#6B7280" />
            <CategoryBadge label="General" count={messagingMetrics.byCategory.general} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Sentiment & FAQ Row */}
      <View style={styles.bottomRow}>
        {/* Sentiment Indicators */}
        <View style={styles.sentimentSection}>
          <Text style={styles.sectionTitle}>Sentiment</Text>
          <View style={styles.sentimentIndicators}>
            <SentimentBadge type="positive" count={sentimentMetrics.positiveCount} />
            <SentimentBadge type="negative" count={sentimentMetrics.negativeCount} />
            <SentimentBadge type="neutral" count={sentimentMetrics.neutralCount} />
          </View>
          {sentimentMetrics.averageSentimentScore !== 0 && (
            <Text style={styles.sentimentScore}>
              Avg: {sentimentMetrics.averageSentimentScore >= 0 ? '+' : ''}
              {sentimentMetrics.averageSentimentScore.toFixed(2)}
            </Text>
          )}
        </View>

        {/* FAQ Metrics */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>FAQs</Text>
          <View style={styles.faqMetrics}>
            <View style={styles.faqMetricItem}>
              <Text style={styles.faqMetricValue} accessibilityLabel={`${faqMetrics.newQuestionsDetected} new FAQ questions detected`}>
                {faqMetrics.newQuestionsDetected}
              </Text>
              <Text style={styles.faqMetricLabel}>New Q's</Text>
            </View>
            <View style={styles.faqMetricItem}>
              <Text style={styles.faqMetricValue} accessibilityLabel={`${faqMetrics.autoResponsesSent} auto-responses sent`}>
                {faqMetrics.autoResponsesSent}
              </Text>
              <Text style={styles.faqMetricLabel}>Auto-Sent</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * CategoryBadge - Displays message category count with colored badge
 */
interface CategoryBadgeProps {
  label: string;
  count: number;
  color: string;
}

function CategoryBadge({ label, count, color }: CategoryBadgeProps) {
  return (
    <View style={styles.categoryBadge} accessibilityLabel={`${label}: ${count} messages`}>
      <View style={[styles.categoryDot, { backgroundColor: color }]} />
      <Text style={styles.categoryLabel}>{label}</Text>
      <Text style={styles.categoryCount}>{count}</Text>
    </View>
  );
}

/**
 * SentimentBadge - Displays sentiment count with colored indicator
 */
interface SentimentBadgeProps {
  type: 'positive' | 'negative' | 'neutral';
  count: number;
}

function SentimentBadge({ type, count }: SentimentBadgeProps) {
  const config = {
    positive: { color: '#48BB78', icon: 'happy-outline' as const, label: 'Positive' },
    negative: { color: '#F56565', icon: 'sad-outline' as const, label: 'Negative' },
    neutral: { color: '#A0AEC0', icon: 'remove-outline' as const, label: 'Neutral' },
  };

  const { color, icon, label } = config[type];

  return (
    <View style={styles.sentimentBadge} accessibilityLabel={`${label}: ${count} messages`}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.sentimentCount, { color }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    color: '#6B7280',
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
    color: '#E53E3E',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3182CE',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Title row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  refreshButton: {
    padding: 4,
  },

  // Main stats row
  mainStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  opportunityCard: {
    backgroundColor: '#F0FDF4',
  },
  crisisCard: {
    backgroundColor: '#FEF2F2',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  opportunityValue: {
    color: '#38A169',
  },
  crisisValue: {
    color: '#E53E3E',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  crisisIcon: {
    marginTop: 4,
  },

  // Category section
  categorySection: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Bottom row (Sentiment & FAQ)
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },

  // Sentiment section
  sentimentSection: {
    flex: 1,
  },
  sentimentIndicators: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  sentimentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sentimentCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  sentimentScore: {
    marginTop: 6,
    fontSize: 11,
    color: '#6B7280',
  },

  // FAQ section
  faqSection: {
    flex: 1,
  },
  faqMetrics: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  faqMetricItem: {
    alignItems: 'center',
  },
  faqMetricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  faqMetricLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
});
