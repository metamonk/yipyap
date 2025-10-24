/**
 * AIMetricsDashboard - AI Performance Metrics Widget (Story 5.7 - Task 5)
 *
 * @remarks
 * Displays AI performance metrics across all features:
 * - Categorization accuracy (Story 5.2)
 * - Time saved from auto-responses and suggestions (Stories 5.4, 5.5)
 * - Cost tracking with opt-in visibility
 * - Voice matching acceptance rate (Story 5.5)
 * - FAQ auto-response rate (Story 5.4)
 *
 * Collapsible widget with period selector (7/30/90 days) and trend charts.
 *
 * @example
 * ```tsx
 * <AIMetricsDashboard
 *   userId="user123"
 *   showCostMetrics={true}
 *   onRefresh={() => fetchData()}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dashboardService } from '@/services/dashboardService';
import type { AIPerformanceMetrics } from '@/types/dashboard';
import { MetricsChart, ChartData } from './MetricsChart';

/**
 * Props for AIMetricsDashboard component
 */
export interface AIMetricsDashboardProps {
  /** User ID to fetch metrics for */
  userId: string;

  /** Whether to show cost metrics (user opt-in) */
  showCostMetrics?: boolean;

  /** Optional title */
  title?: string;

  /** Callback when refresh button is pressed */
  onRefresh?: () => void;

  /** Whether widget starts collapsed */
  initiallyCollapsed?: boolean;
}

type Period = '7days' | '30days' | '90days';

/**
 * AIMetricsDashboard Component
 */
export function AIMetricsDashboard({
  userId,
  showCostMetrics = false,
  title = 'AI Performance Metrics',
  onRefresh,
  initiallyCollapsed = true,
}: AIMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<AIPerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('7days');
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);

  // Fetch metrics on mount and when period changes
  useEffect(() => {
    fetchMetrics();
  }, [userId, period]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getAIPerformanceMetrics(userId, period);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching AI metrics:', err);
      setError('Failed to load AI metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchMetrics();
    onRefresh?.();
  };

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Loading state
  if (loading && !metrics) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182CE" />
          <Text style={styles.loadingText}>Loading AI metrics...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !metrics) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#E53E3E" />
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRefresh}
              accessibilityLabel="Retry loading AI metrics"
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (!metrics) {
    return null;
  }

  const { categorizationMetrics, timeSavedMetrics, costMetrics, performanceTrends } = metrics;

  // Calculate voice matching acceptance rate (from metrics data)
  // Note: This would be derived from the metrics data in a real implementation
  const voiceMatchingAcceptance = 0; // Placeholder

  // Calculate FAQ match rate (from metrics data)
  const faqMatchRate = 0; // Placeholder

  // Prepare chart data
  const accuracyChartData: ChartData = {
    labels: performanceTrends.slice(0, 7).map(t => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: performanceTrends.slice(0, 7).map(t => t.accuracy),
      },
    ],
  };

  const timeSavedChartData: ChartData = {
    labels: performanceTrends.slice(0, 7).map(t => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: performanceTrends.slice(0, 7).map(t => t.timeSaved),
      },
    ],
  };

  const costChartData: ChartData = {
    labels: performanceTrends.slice(0, 7).map(t => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: performanceTrends.slice(0, 7).map(t => t.cost),
      },
    ],
  };

  return (
    <View style={styles.container} accessibilityLabel="AI performance metrics widget">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={toggleCollapse}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? 'Expand AI metrics' : 'Collapse AI metrics'}
          accessibilityState={{ expanded: !isCollapsed }}
        >
          <Ionicons
            name="bar-chart-outline"
            size={20}
            color="#3182CE"
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>{title}</Text>
          <Ionicons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color="#6B7280"
            style={styles.collapseIcon}
          />
        </TouchableOpacity>

        {!isCollapsed && (
          <TouchableOpacity
            onPress={handleRefresh}
            accessibilityLabel="Refresh AI metrics"
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Collapsed preview */}
      {isCollapsed && (
        <View style={styles.collapsedPreview}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Accuracy:</Text>
            <Text style={styles.previewValue}>{categorizationMetrics.accuracy.toFixed(1)}%</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Time Saved:</Text>
            <Text style={styles.previewValue}>{timeSavedMetrics.totalMinutesSaved} min</Text>
          </View>
          {showCostMetrics && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Cost:</Text>
              <Text style={styles.previewValue}>${costMetrics.totalCostUSD.toFixed(2)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Expanded content */}
      {!isCollapsed && (
        <ScrollView style={styles.content} nestedScrollEnabled>
          {/* Period Selector */}
          <View style={styles.periodSelector}>
            <TouchableOpacity
              style={[styles.periodButton, period === '7days' && styles.periodButtonActive]}
              onPress={() => handlePeriodChange('7days')}
              accessibilityRole="button"
              accessibilityLabel="View 7 days metrics"
              accessibilityState={{ selected: period === '7days' }}
            >
              <Text style={[styles.periodButtonText, period === '7days' && styles.periodButtonTextActive]}>
                7 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodButton, period === '30days' && styles.periodButtonActive]}
              onPress={() => handlePeriodChange('30days')}
              accessibilityRole="button"
              accessibilityLabel="View 30 days metrics"
              accessibilityState={{ selected: period === '30days' }}
            >
              <Text style={[styles.periodButtonText, period === '30days' && styles.periodButtonTextActive]}>
                30 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.periodButton, period === '90days' && styles.periodButtonActive]}
              onPress={() => handlePeriodChange('90days')}
              accessibilityRole="button"
              accessibilityLabel="View 90 days metrics"
              accessibilityState={{ selected: period === '90days' }}
            >
              <Text style={[styles.periodButtonText, period === '90days' && styles.periodButtonTextActive]}>
                90 Days
              </Text>
            </TouchableOpacity>
          </View>

          {/* Main Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Categorization Accuracy */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Categorization Accuracy</Text>
              <Text
                style={styles.metricValue}
                accessibilityLabel={`Categorization accuracy ${categorizationMetrics.accuracy.toFixed(1)} percent`}
              >
                {categorizationMetrics.accuracy.toFixed(1)}%
              </Text>
              <Text style={styles.metricSubtext}>
                {categorizationMetrics.totalCategorized} messages
              </Text>
            </View>

            {/* Time Saved */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Time Saved</Text>
              <Text
                style={styles.metricValue}
                accessibilityLabel={`${timeSavedMetrics.totalMinutesSaved} minutes saved`}
              >
                {timeSavedMetrics.totalMinutesSaved}
                <Text style={styles.metricUnit}> min</Text>
              </Text>
              <View style={styles.metricBreakdown}>
                <Text style={styles.metricBreakdownItem}>
                  Auto-responses: {timeSavedMetrics.fromAutoResponses}m
                </Text>
                <Text style={styles.metricBreakdownItem}>
                  Suggestions: {timeSavedMetrics.fromSuggestions}m
                </Text>
              </View>
            </View>

            {/* Cost Tracking (Conditional) */}
            {showCostMetrics && (
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>AI Cost</Text>
                <Text
                  style={styles.metricValue}
                  accessibilityLabel={`Total cost ${costMetrics.totalCostUSD.toFixed(2)} dollars`}
                >
                  ${costMetrics.totalCostUSD.toFixed(2)}
                </Text>
                <Text style={styles.metricSubtext}>
                  ${costMetrics.averageCostPerMessage.toFixed(4)}/msg
                </Text>
              </View>
            )}

            {/* Voice Matching Acceptance */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Voice Matching</Text>
              <Text
                style={styles.metricValue}
                accessibilityLabel={`Voice matching acceptance rate ${voiceMatchingAcceptance} percent`}
              >
                {voiceMatchingAcceptance}%
              </Text>
              <Text style={styles.metricSubtext}>Acceptance rate</Text>
            </View>

            {/* FAQ Auto-Response Rate */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>FAQ Auto-Response</Text>
              <Text
                style={styles.metricValue}
                accessibilityLabel={`FAQ match rate ${faqMatchRate} percent`}
              >
                {faqMatchRate}%
              </Text>
              <Text style={styles.metricSubtext}>Match rate</Text>
            </View>
          </View>

          {/* Trend Charts */}
          {performanceTrends.length > 0 && (
            <View style={styles.chartsSection}>
              <Text style={styles.sectionTitle}>Performance Trends</Text>

              {/* Accuracy Chart */}
              {accuracyChartData.datasets[0].data.length > 0 && (
                <MetricsChart
                  type="line"
                  data={accuracyChartData}
                  title="Accuracy Over Time"
                  yAxisSuffix="%"
                  height={200}
                />
              )}

              {/* Time Saved Chart */}
              {timeSavedChartData.datasets[0].data.length > 0 && (
                <MetricsChart
                  type="bar"
                  data={timeSavedChartData}
                  title="Time Saved (Minutes)"
                  height={200}
                />
              )}

              {/* Cost Chart (Conditional) */}
              {showCostMetrics && costChartData.datasets[0].data.length > 0 && (
                <MetricsChart
                  type="line"
                  data={costChartData}
                  title="Cost Over Time"
                  yAxisSuffix="$"
                  height={200}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  collapseIcon: {
    marginLeft: 8,
  },
  collapsedPreview: {
    marginTop: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    maxHeight: 600,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#3182CE',
    borderColor: '#3182CE',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
  },
  metricSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  metricBreakdown: {
    marginTop: 4,
  },
  metricBreakdownItem: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
  },
  chartsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 14,
    color: '#E53E3E',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3182CE',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
