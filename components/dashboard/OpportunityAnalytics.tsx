/**
 * Opportunity Analytics Component (Story 5.6 - Task 12)
 *
 * @component
 * @remarks
 * Displays historical opportunity tracking with charts, metrics, and export functionality.
 * Shows trends over 7, 30, or 90 days with breakdowns by opportunity type.
 *
 * @example
 * ```tsx
 * <OpportunityAnalytics
 *   userId="user123"
 *   initialPeriod={30}
 *   onExport={(data) => exportToCSV(data)}
 * />
 * ```
 */

import React, { FC, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { opportunityService } from '@/services/opportunityService';
import type { OpportunityAnalytics as OpportunityAnalyticsType } from '@/types/dashboard';

/**
 * Props for OpportunityAnalytics component
 */
export interface OpportunityAnalyticsProps {
  /** User ID to fetch analytics for */
  userId: string;

  /** Initial period in days (7, 30, or 90) */
  initialPeriod?: 7 | 30 | 90;

  /** Optional callback when export is triggered */
  onExport?: (data: OpportunityAnalyticsType) => void;
}

/**
 * OpportunityAnalytics component
 * Displays historical opportunity tracking and analytics
 */
export const OpportunityAnalytics: FC<OpportunityAnalyticsProps> = ({
  userId,
  initialPeriod = 30,
  onExport,
}) => {
  const [period, setPeriod] = useState<7 | 30 | 90>(initialPeriod);
  const [analytics, setAnalytics] = useState<OpportunityAnalyticsType | null>(null);
  const [historyData, setHistoryData] = useState<
    Array<{ date: string; count: number; averageScore: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load analytics data for the selected period
   */
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsData, history] = await Promise.all([
        opportunityService.getOpportunityAnalytics(userId, period),
        opportunityService.getOpportunitiesByDate(userId, period),
      ]);

      setAnalytics(analyticsData);
      setHistoryData(history);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  /**
   * Handle export functionality
   */
  const handleExport = useCallback(async () => {
    if (!analytics) return;

    if (onExport) {
      onExport(analytics);
      return;
    }

    // Default export: Share as text
    const exportText = `Opportunity Analytics (${period} days)

Total Opportunities: ${analytics.totalOpportunities}
High-Value (>=70): ${analytics.highValueCount}
Average Score: ${analytics.averageScore}

Breakdown by Type:
${Object.entries(analytics.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

Historical Data:
${historyData.map((d) => `${d.date}: ${d.count} opportunities (avg: ${d.averageScore})`).join('\n')}`;

    try {
      await Share.share({
        message: exportText,
        title: `Opportunity Analytics - ${period} Days`,
      });
    } catch (err) {
      console.error('Failed to share analytics:', err);
      Alert.alert('Export Failed', 'Could not export analytics data');
    }
  }, [analytics, historyData, period, onExport]);

  /**
   * Render period selector buttons
   */
  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {([7, 30, 90] as const).map((days) => (
        <TouchableOpacity
          key={days}
          style={[styles.periodButton, period === days && styles.periodButtonActive]}
          onPress={() => setPeriod(days)}
          accessibilityLabel={`${days} days period`}
          accessibilityRole="button"
        >
          <Text style={[styles.periodButtonText, period === days && styles.periodButtonTextActive]}>
            {days}D
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /**
   * Render metrics summary cards
   */
  const renderMetrics = () => {
    if (!analytics) return null;

    return (
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{analytics.totalOpportunities}</Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, styles.metricValueHighlight]}>
            {analytics.highValueCount}
          </Text>
          <Text style={styles.metricLabel}>High-Value</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{analytics.averageScore.toFixed(1)}</Text>
          <Text style={styles.metricLabel}>Avg Score</Text>
        </View>
      </View>
    );
  };

  /**
   * Render breakdown by opportunity type
   */
  const renderTypeBreakdown = () => {
    if (!analytics || !analytics.byType) return null;

    const types = Object.entries(analytics.byType)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a); // Sort by count descending

    if (types.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No opportunities in this period</Text>
        </View>
      );
    }

    const maxCount = Math.max(...types.map(([_, count]) => count));

    return (
      <View style={styles.typeBreakdownContainer}>
        <Text style={styles.sectionTitle}>Breakdown by Type</Text>
        {types.map(([type, count]) => {
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const color = getTypeColor(type);

          return (
            <View key={type} style={styles.typeRow}>
              <View style={styles.typeInfo}>
                <View style={[styles.typeIndicator, { backgroundColor: color }]} />
                <Text style={styles.typeName}>{formatTypeName(type)}</Text>
              </View>
              <View style={styles.typeBar}>
                <View style={[styles.typeBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.typeCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  /**
   * Render simple trend visualization
   */
  const renderTrendChart = () => {
    if (historyData.length === 0) return null;

    const maxCount = Math.max(...historyData.map((d) => d.count), 1);
    const chartHeight = 120;

    return (
      <View style={styles.trendChartContainer}>
        <Text style={styles.sectionTitle}>Opportunity Trend</Text>
        <View style={styles.chartWrapper}>
          <View style={styles.chart}>
            {historyData.map((dataPoint, index) => {
              const barHeight = (dataPoint.count / maxCount) * chartHeight;
              const isRecent = index >= historyData.length - 7; // Highlight recent week

              return (
                <View key={dataPoint.date} style={styles.chartBar}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: barHeight,
                        backgroundColor: isRecent ? '#6C63FF' : '#B0B0FF',
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <Text style={styles.chartLabel}>
            {historyData[0]?.date} - {historyData[historyData.length - 1]?.date}
          </Text>
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Opportunity Analytics</Text>
          {renderPeriodSelector()}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Opportunity Analytics</Text>
          {renderPeriodSelector()}
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main content
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Opportunity Analytics</Text>
        {renderPeriodSelector()}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderMetrics()}
        {renderTypeBreakdown()}
        {renderTrendChart()}

        {analytics && analytics.totalOpportunities > 0 && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            accessibilityLabel="Export analytics data"
            accessibilityRole="button"
          >
            <Text style={styles.exportButtonText}>📊 Export Data</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

/**
 * Get color for opportunity type
 */
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    sponsorship: '#FFB300', // Amber
    collaboration: '#6C63FF', // Purple
    partnership: '#00C853', // Green
    sale: '#FF6D00', // Orange
    unknown: '#9E9E9E', // Gray
  };
  return colors[type] || colors.unknown;
}

/**
 * Format type name for display
 */
function formatTypeName(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  periodButtonActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#FFF',
  },
  content: {
    maxHeight: 500,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6C63FF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F5F5FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricValueHighlight: {
    color: '#6C63FF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  typeBreakdownContainer: {
    marginBottom: 24,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  typeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  typeName: {
    fontSize: 14,
    color: '#333',
  },
  typeBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  typeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  typeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 40,
    textAlign: 'right',
  },
  trendChartContainer: {
    marginBottom: 24,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 2,
    paddingHorizontal: 4,
  },
  chartBar: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  exportButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  exportButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
  },
});
