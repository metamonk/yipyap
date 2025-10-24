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
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [metrics, setMetrics] = useState<OperationMetrics[]>([]);
  const [rateLimits, setRateLimits] = useState<Record<string, RateLimitStatus>>({});
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = getFirebaseAuth();
  const userId = auth.currentUser?.uid || '';

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
        const opMetrics = await getOperationMetrics(userId, operation, startTime, now);
        const rateLimitStatus = await getRateLimitStatus(userId, operation);

        setRateLimits(prev => ({
          ...prev,
          [operation]: rateLimitStatus,
        }));

        return opMetrics;
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
        timeRange === range && styles.timeRangeButtonActive,
      ]}
      onPress={() => setTimeRange(range)}
      accessibilityLabel={`Select ${label} time range`}
      accessibilityRole="button"
      accessibilityState={{ selected: timeRange === range }}
    >
      <Text
        style={[
          styles.timeRangeButtonText,
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
      <View key={metric.operation} style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <View style={styles.metricTitleRow}>
            <Ionicons
              name={operationIcons[metric.operation]}
              size={20}
              color="#6C63FF"
              accessibilityLabel={`${operationLabels[metric.operation]} icon`}
            />
            <Text style={styles.metricTitle}>{operationLabels[metric.operation]}</Text>
          </View>
          {isNearLimit && (
            <View style={styles.warningBadge} accessibilityLabel="Approaching rate limit">
              <Ionicons name="warning" size={16} color="#F59E0B" />
            </View>
          )}
        </View>

        <View style={styles.metricsGrid}>
          {/* Latency Metrics */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel} accessibilityLabel="Average latency">Avg Latency</Text>
            <Text style={styles.metricValue}>{metric.averageLatency.toFixed(0)}ms</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel} accessibilityLabel="P95 latency">P95</Text>
            <Text style={styles.metricValue}>{metric.p95Latency.toFixed(0)}ms</Text>
          </View>

          {/* Success Rate */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel} accessibilityLabel="Success rate">Success Rate</Text>
            <Text
              style={[
                styles.metricValue,
                metric.successRate >= 0.99 ? styles.successHigh : styles.successLow,
              ]}
            >
              {(metric.successRate * 100).toFixed(1)}%
            </Text>
          </View>

          {/* Cache Hit Rate */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel} accessibilityLabel="Cache hit rate">Cache Hit</Text>
            <Text style={styles.metricValue}>
              {(metric.cacheHitRate * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Rate Limit Status */}
        {rateLimitStatus && (
          <View style={styles.rateLimitSection}>
            <Text style={styles.rateLimitLabel}>Rate Limits:</Text>
            <Text style={styles.rateLimitText} accessibilityLabel={`Hourly: ${rateLimitStatus.hourlyCount} of ${rateLimitStatus.hourlyLimit}`}>
              Hourly: {rateLimitStatus.hourlyCount}/{rateLimitStatus.hourlyLimit}
            </Text>
            <Text style={styles.rateLimitText} accessibilityLabel={`Daily: ${rateLimitStatus.dailyCount} of ${rateLimitStatus.dailyLimit}`}>
              Daily: {rateLimitStatus.dailyCount}/{rateLimitStatus.dailyLimit}
            </Text>
          </View>
        )}

        <Text style={styles.operationCount} accessibilityLabel={`${metric.totalOperations} operations`}>
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
    <View key={rec.id} style={styles.recommendationCard}>
      <View style={styles.recommendationHeader}>
        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(rec.severity) }]}>
          <Text style={styles.severityText} accessibilityLabel={`${rec.severity} severity`}>
            {rec.severity.toUpperCase()}
          </Text>
        </View>
        <Ionicons name="bulb" size={20} color="#F59E0B" accessibilityLabel="Recommendation icon" />
      </View>
      <Text style={styles.recommendationTitle}>{rec.title}</Text>
      <Text style={styles.recommendationDescription}>{rec.description}</Text>
      {rec.impact && (
        <Text style={styles.recommendationImpact} accessibilityLabel={`Impact: ${rec.impact}`}>
          💡 {rec.impact}
        </Text>
      )}
      {rec.actionSteps && rec.actionSteps.length > 0 && (
        <View style={styles.actionSteps}>
          <Text style={styles.actionStepsTitle}>Action Steps:</Text>
          {rec.actionSteps.map((step, index) => (
            <Text key={index} style={styles.actionStep}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'AI Performance',
            headerShown: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" accessibilityLabel="Loading performance data" />
          <Text style={styles.loadingText}>Loading performance data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'AI Performance',
            headerShown: true,
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" accessibilityLabel="Error icon" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} accessibilityLabel="Retry" accessibilityRole="button">
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            colors={['#6C63FF']}
            tintColor="#6C63FF"
          />
        }
      >
        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Time Range</Text>
          <View style={styles.timeRangeButtons}>
            {renderTimeRangeButton('24h', '24 Hours')}
            {renderTimeRangeButton('7d', '7 Days')}
            {renderTimeRangeButton('30d', '30 Days')}
          </View>
        </View>

        {/* Operation Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Operation Performance</Text>
          {metrics.length === 0 ? (
            <Text style={styles.noDataText}>No performance data available for this time range</Text>
          ) : (
            metrics.map(renderOperationMetrics)
          )}
        </View>

        {/* Optimization Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Optimization Recommendations</Text>
            {recommendations.map(renderRecommendation)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
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
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6C63FF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  timeRangeContainer: {
    marginBottom: 24,
  },
  timeRangeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    maxWidth: isTablet ? 600 : '100%',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  warningBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
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
    color: '#6B7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  successHigh: {
    color: '#10B981',
  },
  successLow: {
    color: '#EF4444',
  },
  rateLimitSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  rateLimitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  rateLimitText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  operationCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 32,
  },
  recommendationCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    maxWidth: isTablet ? 600 : '100%',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  recommendationImpact: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 8,
  },
  actionSteps: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  actionStepsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  actionStep: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 4,
    paddingLeft: 8,
  },
});
