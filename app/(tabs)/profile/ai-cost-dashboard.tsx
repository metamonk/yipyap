/**
 * AI Cost Monitoring Dashboard (Story 5.9 - Task 7)
 *
 * @remarks
 * Displays comprehensive AI cost tracking and budget management:
 * - Daily cost chart (last 30 days)
 * - Monthly cost overview
 * - Cost breakdown by operation type
 * - Budget progress indicator
 * - Daily/monthly toggle
 * - Export functionality for cost reports
 *
 * @example
 * ```tsx
 * // Navigate to: /profile/ai-cost-dashboard
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getDailyCosts,
  getMonthlyCosts,
  // getTotalCost, // TODO: Use for total cost display
  type DailyCost,
  type MonthlyCost,
} from '@/services/aiCostMonitoringService';
import { MetricsChart, type ChartData } from '@/components/dashboard/MetricsChart';

type TimePeriod = 'daily' | 'monthly';

/**
 * AI Cost Dashboard Screen Component
 */
export default function AICostDashboardScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<TimePeriod>('daily');
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userBudget] = useState(500); // Default $5.00/day budget // TODO: Implement budget management

  const auth = getFirebaseAuth();
  const userId = auth.currentUser?.uid || '';

  const fetchCostData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (period === 'daily') {
        const costs = await getDailyCosts(userId, 30); // Last 30 days
        setDailyCosts(costs);
      } else {
        const costs = await getMonthlyCosts(userId, 12); // Last 12 months
        setMonthlyCosts(costs);
      }
    } catch (err) {
      console.error('[AICostDashboard] Error fetching cost data:', err);
      setError('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => {
    if (userId) {
      fetchCostData();
    }
  }, [userId, fetchCostData]);

  const handleRefresh = () => {
    fetchCostData();
  };

  const handleExport = async () => {
    try {
      const data = period === 'daily' ? dailyCosts : monthlyCosts;
      const csvContent = generateCSV(data);

      if (Platform.OS === 'web') {
        // Web export
        // eslint-disable-next-line no-undef
        const blob = new Blob([csvContent], { type: 'text/csv' });
        // eslint-disable-next-line no-undef
        const url = window.URL.createObjectURL(blob);
        // eslint-disable-next-line no-undef
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-costs-${period}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } else {
        // Mobile export via Share
        await Share.share({
          message: csvContent,
          title: `AI Costs - ${period}`,
        });
      }
    } catch (error) {
      console.error('[AICostDashboard] Error exporting data:', error);
      Alert.alert('Export Failed', 'Unable to export cost data');
    }
  };

  const generateCSV = (data: DailyCost[] | MonthlyCost[]): string => {
    if (data.length === 0) return '';

    const isDaily = period === 'daily';
    const headers = isDaily
      ? 'Date,Total Cost,Categorization,Sentiment,FAQ Detection,Voice Matching,Opportunity,Daily Agent'
      : 'Month,Total Cost,Categorization,Sentiment,FAQ Detection,Voice Matching,Opportunity,Daily Agent';

    const rows = data.map((item) => {
      const date = isDaily
        ? (item as DailyCost).date.toLocaleDateString()
        : `${(item as MonthlyCost).year}-${String((item as MonthlyCost).month).padStart(2, '0')}`;

      const costs = item.operationCosts || {};
      return [
        date,
        (item.totalCostCents / 100).toFixed(4),
        ((costs.categorization || 0) / 100).toFixed(4),
        ((costs.sentiment || 0) / 100).toFixed(4),
        ((costs.faq_detection || 0) / 100).toFixed(4),
        ((costs.voice_matching || 0) / 100).toFixed(4),
        ((costs.opportunity_scoring || 0) / 100).toFixed(4),
        ((costs.daily_agent || 0) / 100).toFixed(4),
      ].join(',');
    });

    return [headers, ...rows].join('\n');
  };

  // Prepare chart data
  const chartData: ChartData = {
    labels: [],
    datasets: [{ data: [] }],
  };

  if (period === 'daily' && dailyCosts.length > 0) {
    chartData.labels = dailyCosts.slice(-14).map((cost) =>
      cost.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    chartData.datasets[0].data = dailyCosts.slice(-14).map((cost) => cost.totalCostCents / 100);
  } else if (period === 'monthly' && monthlyCosts.length > 0) {
    chartData.labels = monthlyCosts.slice(-6).map((cost) =>
      `${cost.year}-${String(cost.month).padStart(2, '0')}`
    );
    chartData.datasets[0].data = monthlyCosts.slice(-6).map((cost) => cost.totalCostCents / 100);
  }

  // Calculate current spend and budget progress
  const currentSpend = period === 'daily'
    ? (dailyCosts[dailyCosts.length - 1]?.totalCostCents || 0) / 100
    : (monthlyCosts[monthlyCosts.length - 1]?.totalCostCents || 0) / 100;

  const budgetProgress = (currentSpend / (userBudget / 100)) * 100;
  const budgetColor =
    budgetProgress >= 100 ? '#E53E3E' : budgetProgress >= 80 ? '#D69E2E' : '#38A169';

  // Calculate operation breakdown
  const operationBreakdown = period === 'daily'
    ? dailyCosts[dailyCosts.length - 1]?.operationCosts || {}
    : monthlyCosts[monthlyCosts.length - 1]?.operationCosts || {};

  const operationLabels = [
    { key: 'categorization', label: 'Categorization', icon: 'folder-outline' },
    { key: 'sentiment', label: 'Sentiment', icon: 'happy-outline' },
    { key: 'faq_detection', label: 'FAQ Detection', icon: 'help-circle-outline' },
    { key: 'voice_matching', label: 'Voice Matching', icon: 'mic-outline' },
    { key: 'opportunity_scoring', label: 'Opportunities', icon: 'trending-up-outline' },
    { key: 'daily_agent', label: 'Daily Agent', icon: 'calendar-outline' },
  ];

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="AI Cost Monitoring"
        variant="modal"
        leftAction={{
          icon: 'arrow-back',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          },
        }}
        rightAction={{
          icon: 'refresh',
          onPress: handleRefresh,
        }}
      />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Period Toggle */}
        <View style={styles.periodToggle}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'daily' && styles.periodButtonActive]}
            onPress={() => setPeriod('daily')}
            accessibilityLabel="Show daily costs"
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'daily' }}
          >
            <Text style={[styles.periodButtonText, period === 'daily' && styles.periodButtonTextActive]}>
              Daily
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'monthly' && styles.periodButtonActive]}
            onPress={() => setPeriod('monthly')}
            accessibilityLabel="Show monthly costs"
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'monthly' }}
          >
            <Text style={[styles.periodButtonText, period === 'monthly' && styles.periodButtonTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3182CE" />
            <Text style={styles.loadingText}>Loading cost data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#E53E3E" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Budget Progress */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Budget Progress</Text>
              <View style={styles.budgetContainer}>
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetLabel}>{period === 'daily' ? 'Today' : 'This Month'}</Text>
                  <Text style={[styles.budgetAmount, { color: budgetColor }]}>
                    ${currentSpend.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${Math.min(budgetProgress, 100)}%`, backgroundColor: budgetColor }]} />
                </View>
                <View style={styles.budgetFooter}>
                  <Text style={styles.budgetSubtext}>
                    ${(userBudget / 100).toFixed(2)} {period === 'daily' ? 'daily' : 'monthly'} budget
                  </Text>
                  <Text style={[styles.budgetPercent, { color: budgetColor }]}>
                    {budgetProgress.toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Cost Chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {period === 'daily' ? 'Daily Costs (Last 14 Days)' : 'Monthly Costs (Last 6 Months)'}
              </Text>
              {chartData.labels.length > 0 ? (
                <MetricsChart
                  type="line"
                  data={chartData}
                  yAxisSuffix="$"
                  height={220}
                  hideLegend
                />
              ) : (
                <View style={styles.emptyChart}>
                  <Text style={styles.emptyChartText}>No cost data available</Text>
                </View>
              )}
            </View>

            {/* Operation Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cost Breakdown by Operation</Text>
              <View style={styles.operationsContainer}>
                {operationLabels.map((op) => {
                  const cost = (operationBreakdown[op.key] || 0) / 100;
                  const percentage = currentSpend > 0 ? (cost / currentSpend) * 100 : 0;

                  return (
                    <View key={op.key} style={styles.operationRow}>
                      <View style={styles.operationLeft}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Ionicons name={op.icon as any} size={20} color="#6B7280" />
                        <Text style={styles.operationLabel}>{op.label}</Text>
                      </View>
                      <View style={styles.operationRight}>
                        <Text style={styles.operationCost}>${cost.toFixed(4)}</Text>
                        <Text style={styles.operationPercent}>({percentage.toFixed(0)}%)</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Export Button */}
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExport}
              accessibilityLabel="Export cost data as CSV"
              accessibilityRole="button"
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Export as CSV</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#3182CE',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: '#E53E3E',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#3182CE',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  budgetContainer: {
    gap: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  budgetAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  budgetPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyChart: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  operationsContainer: {
    gap: 12,
  },
  operationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  operationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  operationLabel: {
    fontSize: 14,
    color: '#374151',
  },
  operationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  operationCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  operationPercent: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3182CE',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
