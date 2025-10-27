/**
 * AI Performance Monitoring Dashboard (Story 5.9 - Task 12)
 *
 * @remarks
 * Displays comprehensive AI performance metrics and optimization recommendations:
 * - Latency metrics per operation type (p50, p95, p99)
 * - Success rate metrics
 * - Cache hit rate display
 * - Rate limit status indicators
 * - Optimization recommendations
 * - Real-time updates via Firestore listeners
 * - Time range selector (24h, 7d, 30d)
 *
 * @example
 * ```tsx
 * // Navigate to: /profile/ai-performance-dashboard
 * ```
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebaseAuth } from '@/services/firebase';
import { getOperationMetrics } from '@/services/aiPerformanceService';
import { getRateLimitStatus, type RateLimitStatus } from '@/services/aiRateLimitService';
import { collection, query, where, onSnapshot, orderBy, limit, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '@/services/firebase';
import type { OptimizationRecommendation, CacheMetrics } from '@/types/ai';

type TimeRange = '24h' | '7d' | '30d';
type OperationType = 'categorization' | 'sentiment' | 'faq_detection' | 'voice_matching' | 'opportunity_scoring' | 'daily_agent';

/**
 * Performance metrics for a single operation type
 */
interface OperationMetrics {
  operation: OperationType;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  cacheHitRate: number;
  totalOperations: number;
}

/**
 * AI Performance Dashboard Screen Component
 *
 * @component
 * @example
 * ```tsx
 * <AIPerformanceDashboardScreen />
 * ```
 */
export default function AIPerformanceDashboardScreen() {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [metrics, setMetrics] = useState<OperationMetrics[]>([]);
  const [rateLimits, setRateLimits] = useState<Record<string, RateLimitStatus>>({});
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = getFirebaseAuth();
  const userId = auth.currentUser?.uid || '';

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
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
    loadingText: {
      color: theme.colors.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    retryButton: {
      backgroundColor: theme.colors.accent,
    },
    timeRangeButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    timeRangeButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    timeRangeButtonText: {
      color: theme.colors.textSecondary,
    },
    metricCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    metricTitle: {
      color: theme.colors.textPrimary,
    },
    metricLabel: {
      color: theme.colors.textSecondary,
    },
    metricValue: {
      color: theme.colors.textPrimary,
    },
    successHigh: {
      color: theme.colors.success || '#10B981',
    },
    successLow: {
      color: theme.colors.error,
    },
    rateLimitLabel: {
      color: theme.colors.textSecondary,
    },
    rateLimitText: {
      color: theme.colors.textPrimary,
    },
    operationCount: {
      color: theme.colors.textSecondary,
    },
    noDataCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    noDataText: {
      color: theme.colors.textSecondary,
    },
    recommendationCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    recommendationTitle: {
      color: theme.colors.textPrimary,
    },
    recommendationDescription: {
      color: theme.colors.textSecondary,
    },
    recommendationImpact: {
      color: theme.colors.success || '#059669',
    },
    actionStepsTitle: {
      color: theme.colors.textPrimary,
    },
    actionStep: {
      color: theme.colors.textSecondary,
    },
    actionStepsBorder: {
      borderTopColor: theme.colors.borderLight,
    },
    warningBadge: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.warning || '#F59E0B',
    },
    rateLimitSection: {
      borderTopColor: theme.colors.borderLight,
    },
  });

  /**
   * Aggregates raw performance metrics into computed statistics
   */
  const aggregateMetrics = (rawMetrics: any[], operation: OperationType): OperationMetrics | null => {
    if (!rawMetrics || rawMetrics.length === 0) {
      return {
        operation,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        successRate: 0,
        cacheHitRate: 0,
        totalOperations: 0,
      };
    }

    // Extract latencies and sort for percentile calculation
    const latencies = rawMetrics.map(m => m.latency || 0).sort((a, b) => a - b);
    const successCount = rawMetrics.filter(m => m.success).length;
    const cacheHits = rawMetrics.filter(m => m.cacheHit).length;

    const percentile = (arr: number[], p: number) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)] || 0;
    };

    return {
      operation,
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
      p50Latency: percentile(latencies, 50),
      p95Latency: percentile(latencies, 95),
      p99Latency: percentile(latencies, 99),
      successRate: successCount / rawMetrics.length || 0,
      cacheHitRate: cacheHits / rawMetrics.length || 0,
      totalOperations: rawMetrics.length,
    };
  };

  useEffect(() => {
    if (userId) {
      fetchPerformanceData();
      setupRealtimeListeners();
    }
  }, [userId, timeRange]);

  /**
   * Fetches performance metrics for all operations
   */
  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const operations: OperationType[] = [
        'categorization',
        'sentiment',
        'faq_detection',
        'voice_matching',
        'opportunity_scoring',
        'daily_agent',
      ];

      // Calculate time window based on selected range
      const now = new Date();
      const startTime = new Date(now);
      if (timeRange === '24h') {
        startTime.setHours(startTime.getHours() - 24);
      } else if (timeRange === '7d') {
        startTime.setDate(startTime.getDate() - 7);
      } else {
        startTime.setDate(startTime.getDate() - 30);
      }

      // Fetch metrics for each operation
      const metricsPromises = operations.map(async (operation) => {
        const rawMetrics = await getOperationMetrics(userId, operation, startTime, now);
        const rateLimitStatus = await getRateLimitStatus(userId, operation);

        setRateLimits(prev => ({
          ...prev,
          [operation]: rateLimitStatus,
        }));

        // Aggregate raw metrics into computed statistics
        return aggregateMetrics(rawMetrics, operation);
      });

      const allMetrics = await Promise.all(metricsPromises);
      setMetrics(allMetrics.filter(m => m !== null) as OperationMetrics[]);
    } catch (err) {
      console.error('[AIPerformanceDashboard] Error fetching data:', err);
      setError('Failed to load performance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Sets up real-time Firestore listeners for recommendations
   */
  const setupRealtimeListeners = () => {
    const db = getFirestore(getFirebaseApp());

    // Listen for optimization recommendations
    const recommendationsRef = collection(db, `users/${userId}/ai_optimization_recommendations`);
    const recommendationsQuery = query(
      recommendationsRef,
      where('dismissedAt', '==', null),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      recommendationsQuery,
      (snapshot) => {
        const recs: OptimizationRecommendation[] = [];
        snapshot.forEach((doc) => {
          recs.push({ id: doc.id, ...doc.data() } as OptimizationRecommendation);
        });
        setRecommendations(recs);
      },
      (error) => {
        console.error('[AIPerformanceDashboard] Error listening to recommendations:', error);
      }
    );

    return () => unsubscribe();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPerformanceData();
  };

  /**
   * Renders a time range selector button
   */
  const renderTimeRangeButton = (range: TimeRange, label: string) => (
    <TouchableOpacity
      key={range}
      style={[
        styles.timeRangeButton,
        dynamicStyles.timeRangeButton,
        timeRange === range && dynamicStyles.timeRangeButtonActive,
      ]}
      onPress={() => setTimeRange(range)}
      accessibilityLabel={`Select ${label} time range`}
      accessibilityRole="button"
      accessibilityState={{ selected: timeRange === range }}
    >
      <Text
        style={[
          styles.timeRangeButtonText,
          dynamicStyles.timeRangeButtonText,
          timeRange === range && styles.timeRangeButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  /**
   * Renders performance metrics for a single operation
   */
  const renderOperationMetrics = (metric: OperationMetrics) => {
    const operationLabels: Record<OperationType, string> = {
      categorization: 'Categorization',
      sentiment: 'Sentiment Analysis',
      faq_detection: 'FAQ Detection',
      voice_matching: 'Voice Matching',
      opportunity_scoring: 'Opportunity Scoring',
      daily_agent: 'Daily Agent',
    };

    const operationIcons: Record<OperationType, keyof typeof Ionicons.glyphMap> = {
      categorization: 'pricetag',
      sentiment: 'happy',
      faq_detection: 'help-circle',
      voice_matching: 'mic',
      opportunity_scoring: 'trending-up',
      daily_agent: 'calendar',
    };

    const rateLimitStatus = rateLimits[metric.operation];
    const isNearLimit = rateLimitStatus && (
      rateLimitStatus.hourlyCount / rateLimitStatus.hourlyLimit > 0.8 ||
      rateLimitStatus.dailyCount / rateLimitStatus.dailyLimit > 0.8
    );

    return (
      <View key={metric.operation} style={[styles.metricCard, dynamicStyles.metricCard]}>
        <View style={styles.metricHeader}>
          <View style={styles.metricTitleRow}>
            <Ionicons
              name={operationIcons[metric.operation]}
              size={20}
              color={theme.colors.accent}
              accessibilityLabel={`${operationLabels[metric.operation]} icon`}
            />
            <Text style={[styles.metricTitle, dynamicStyles.metricTitle]}>{operationLabels[metric.operation]}</Text>
          </View>
          {isNearLimit && (
            <View style={[styles.warningBadge, dynamicStyles.warningBadge]} accessibilityLabel="Approaching rate limit">
              <Ionicons name="warning" size={16} color={theme.colors.warning || '#F59E0B'} />
            </View>
          )}
        </View>

        <View style={styles.metricsGrid}>
          {/* Latency Metrics */}
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, dynamicStyles.metricLabel]} accessibilityLabel="Average latency">Avg Latency</Text>
            <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{metric.averageLatency.toFixed(0)}ms</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, dynamicStyles.metricLabel]} accessibilityLabel="P95 latency">P95</Text>
            <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{metric.p95Latency.toFixed(0)}ms</Text>
          </View>

          {/* Success Rate */}
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, dynamicStyles.metricLabel]} accessibilityLabel="Success rate">Success Rate</Text>
            <Text
              style={[
                styles.metricValue,
                metric.successRate >= 0.99 ? dynamicStyles.successHigh : dynamicStyles.successLow,
              ]}
            >
              {(metric.successRate * 100).toFixed(1)}%
            </Text>
          </View>

          {/* Cache Hit Rate */}
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, dynamicStyles.metricLabel]} accessibilityLabel="Cache hit rate">Cache Hit</Text>
            <Text style={[styles.metricValue, dynamicStyles.metricValue]}>
              {(metric.cacheHitRate * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Rate Limit Status */}
        {rateLimitStatus && (
          <View style={[styles.rateLimitSection, dynamicStyles.rateLimitSection]}>
            <Text style={[styles.rateLimitLabel, dynamicStyles.rateLimitLabel]}>Rate Limits:</Text>
            <Text style={[styles.rateLimitText, dynamicStyles.rateLimitText]} accessibilityLabel={`Hourly: ${rateLimitStatus.hourlyCount} of ${rateLimitStatus.hourlyLimit}`}>
              Hourly: {rateLimitStatus.hourlyCount}/{rateLimitStatus.hourlyLimit}
            </Text>
            <Text style={[styles.rateLimitText, dynamicStyles.rateLimitText]} accessibilityLabel={`Daily: ${rateLimitStatus.dailyCount} of ${rateLimitStatus.dailyLimit}`}>
              Daily: {rateLimitStatus.dailyCount}/{rateLimitStatus.dailyLimit}
            </Text>
          </View>
        )}

        <Text style={[styles.operationCount, dynamicStyles.operationCount]} accessibilityLabel={`${metric.totalOperations} operations`}>
          {metric.totalOperations} operations
        </Text>
      </View>
    );
  };

  /**
   * Renders severity badge for recommendations
   */
  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  /**
   * Renders optimization recommendations
   */
  const renderRecommendation = (rec: OptimizationRecommendation) => (
    <View key={rec.id} style={[styles.recommendationCard, dynamicStyles.recommendationCard]}>
      <View style={styles.recommendationHeader}>
        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(rec.severity) }]}>
          <Text style={styles.severityText} accessibilityLabel={`${rec.severity} severity`}>
            {rec.severity.toUpperCase()}
          </Text>
        </View>
        <Ionicons name="bulb" size={20} color={theme.colors.warning || '#F59E0B'} accessibilityLabel="Recommendation icon" />
      </View>
      <Text style={[styles.recommendationTitle, dynamicStyles.recommendationTitle]}>{rec.title}</Text>
      <Text style={[styles.recommendationDescription, dynamicStyles.recommendationDescription]}>{rec.description}</Text>
      {rec.impact && (
        <Text style={[styles.recommendationImpact, dynamicStyles.recommendationImpact]} accessibilityLabel={`Impact: ${rec.impact}`}>
          💡 {rec.impact}
        </Text>
      )}
      {rec.actionSteps && rec.actionSteps.length > 0 && (
        <View style={[styles.actionSteps, dynamicStyles.actionStepsBorder]}>
          <Text style={[styles.actionStepsTitle, dynamicStyles.actionStepsTitle]}>Action Steps:</Text>
          {rec.actionSteps.map((step, index) => (
            <Text key={index} style={[styles.actionStep, dynamicStyles.actionStep]}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={dynamicStyles.container}>
        <Stack.Screen
          options={{
            title: 'AI Performance',
            headerShown: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} accessibilityLabel="Loading performance data" />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading performance data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={dynamicStyles.container}>
        <Stack.Screen
          options={{
            title: 'AI Performance',
            headerShown: true,
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.error} accessibilityLabel="Error icon" />
          <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, dynamicStyles.retryButton]} onPress={handleRefresh} accessibilityLabel="Retry" accessibilityRole="button">
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <Stack.Screen
        options={{
          title: 'AI Performance',
          headerShown: true,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Page Title */}
        <Text style={[styles.title, dynamicStyles.title]}>AI Performance Monitoring</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Track AI operation metrics, latency, and optimization opportunities
        </Text>

        {/* Time Range Selector */}
        <Text style={dynamicStyles.sectionHeader}>TIME RANGE</Text>
        <View style={styles.timeRangeButtons}>
          {renderTimeRangeButton('24h', '24 Hours')}
          {renderTimeRangeButton('7d', '7 Days')}
          {renderTimeRangeButton('30d', '30 Days')}
        </View>

        {/* Operation Metrics */}
        <Text style={dynamicStyles.sectionHeader}>OPERATION PERFORMANCE</Text>
        {metrics.length === 0 ? (
          <View style={[styles.noDataCard, dynamicStyles.noDataCard]}>
            <Text style={[styles.noDataText, dynamicStyles.noDataText]}>
              No performance data available for this time range
            </Text>
          </View>
        ) : (
          metrics.map(renderOperationMetrics)
        )}

        {/* Optimization Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <Text style={dynamicStyles.sectionHeader}>OPTIMIZATION RECOMMENDATIONS</Text>
            {recommendations.map(renderRecommendation)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
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
    marginBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timeRangeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  metricCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    maxWidth: isTablet ? 600 : '100%',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  rateLimitSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  rateLimitLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  rateLimitText: {
    fontSize: 12,
    marginBottom: 3,
  },
  operationCount: {
    fontSize: 11,
    marginTop: 8,
  },
  noDataCard: {
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
  },
  recommendationsSection: {
    marginTop: 8,
  },
  recommendationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderWidth: 1,
    maxWidth: isTablet ? 600 : '100%',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  recommendationDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  recommendationImpact: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionSteps: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionStepsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionStep: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
    paddingLeft: 4,
  },
});
