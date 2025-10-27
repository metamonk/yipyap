/**
 * Engagement Health Dashboard Screen (Story 6.6)
 * @remarks
 * Displays comprehensive engagement quality metrics including health score,
 * personal response rate, response time, conversation depth, capacity usage,
 * and burnout risk assessment with actionable recommendations.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebaseAuth } from '@/services/firebase';
import { engagementMetricsService } from '@/services/engagementMetricsService';
import { EngagementMetrics } from '@/types/user';

/**
 * Engagement Health Dashboard Screen Component
 * @component
 */
export default function EngagementHealthScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    emptyTitle: {
      color: theme.colors.textPrimary,
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
    emptyHint: {
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    healthScoreCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    healthScoreLabel: {
      color: theme.colors.textSecondary,
    },
    healthScoreValue: {
      color: theme.colors.textPrimary,
    },
    trendText: {
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
    metricValue: {
      color: theme.colors.textPrimary,
    },
    metricTarget: {
      color: theme.colors.textSecondary,
    },
    metricDescription: {
      color: theme.colors.textSecondary,
    },
    metricTrend: {
      color: theme.colors.textSecondary,
    },
    progressBarBg: {
      backgroundColor: theme.colors.borderLight,
    },
    burnoutCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    burnoutTitle: {
      color: theme.colors.textPrimary,
    },
    burnoutDescription: {
      color: theme.colors.textSecondary,
    },
    recommendationsCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    recommendationsTitle: {
      color: theme.colors.textPrimary,
    },
    recommendationBullet: {
      color: theme.colors.accent,
    },
    recommendationText: {
      color: theme.colors.textSecondary,
    },
    lastUpdated: {
      color: theme.colors.textSecondary,
    },
  });

  // Load metrics on mount
  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 5 minutes when screen is active (Task 7)
  useEffect(() => {
    const interval = setInterval(() => {
      loadMetrics(false); // Silent refresh
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load engagement metrics from service
   * @param showLoading - Whether to show loading indicator
   */
  async function loadMetrics(showLoading = true) {
    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }

      const latestMetrics = await engagementMetricsService.getLatestEngagementMetrics(
        currentUser.uid,
        'daily'
      );

      setMetrics(latestMetrics);
    } catch (error) {
      console.error('Error loading engagement metrics:', error);
      Alert.alert('Error', 'Failed to load engagement metrics. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }

  /**
   * Handle pull-to-refresh
   */
  async function handleRefresh() {
    setRefreshing(true);
    await loadMetrics(false);
  }

  /**
   * Navigate to capacity settings
   */
  function navigateToCapacitySettings() {
    router.push('/(tabs)/profile/capacity-settings');
  }

  if (loading && !metrics) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader title="Engagement Health" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading your health metrics...</Text>
        </View>
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader title="Engagement Health" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>No Data Available Yet</Text>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
            Your engagement health metrics will appear here once you start having conversations.
          </Text>
          <Text style={[styles.emptyHint, dynamicStyles.emptyHint]}>
            Metrics update automatically each day and include:{'\n\n'}
            • Personal Response Rate{'\n'}
            • Average Response Time{'\n'}
            • Conversation Depth{'\n'}
            • Capacity Usage{'\n'}
            • Burnout Risk Assessment
          </Text>
        </View>
      </View>
    );
  }

  const recommendations = generateRecommendations(metrics);
  const hasUnhealthy = hasUnhealthyMetrics(metrics);

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader title="Engagement Health" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Page Header */}
        <Text style={[styles.title, dynamicStyles.title]}>Engagement Health</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Monitor your engagement quality and burnout risk
        </Text>

        {/* Health Score Section */}
        <Text style={dynamicStyles.sectionHeader}>HEALTH SCORE</Text>
        <View style={[styles.healthScoreCard, dynamicStyles.healthScoreCard]}>
          <Text style={[styles.healthScoreLabel, dynamicStyles.healthScoreLabel]}>Overall Health Score</Text>
          <Text style={[styles.healthScoreValue, dynamicStyles.healthScoreValue]}>
            {metrics.metrics.qualityScore}/100
          </Text>
          <HealthScoreBadge score={metrics.metrics.qualityScore} />

          {/* Week-over-week trend */}
          {metrics.trends && (
            <Text style={[styles.trendText, dynamicStyles.trendText]}>
              {metrics.trends.qualityScoreDiff >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(metrics.trends.qualityScoreDiff)} points from last week
            </Text>
          )}
        </View>

        {/* Engagement Metrics Section */}
        <Text style={dynamicStyles.sectionHeader}>ENGAGEMENT METRICS</Text>

        {/* Personal Response Rate Metric */}
        <MetricCard
          title="Personal Response Rate"
          value={`${metrics.metrics.personalResponseRate}%`}
          target={80}
          description="% of AI drafts you edited before sending"
          icon="📝"
          status={getMetricStatus(metrics.metrics.personalResponseRate, 80, 60)}
          trend={metrics.trends?.personalResponseRateDiff}
          dynamicStyles={dynamicStyles}
        />

        {/* Average Response Time Metric */}
        <MetricCard
          title="Average Response Time"
          value={`${metrics.metrics.avgResponseTime.toFixed(1)}h`}
          target={24}
          description="Time from message received to response sent"
          icon="⏱️"
          status={getResponseTimeStatus(metrics.metrics.avgResponseTime)}
          trend={metrics.trends?.avgResponseTimeDiff}
          invertTrend={true} // Lower is better for response time
          dynamicStyles={dynamicStyles}
        />

        {/* Conversation Depth Metric */}
        <MetricCard
          title="Conversation Depth"
          value={`${metrics.metrics.conversationDepth}%`}
          target={40}
          description="% of conversations with 3+ exchanges"
          icon="💬"
          status={getMetricStatus(metrics.metrics.conversationDepth, 40, 25)}
          trend={metrics.trends?.conversationDepthDiff}
          dynamicStyles={dynamicStyles}
        />

        {/* Capacity Usage Metric */}
        <CapacityUsageCard metrics={metrics} dynamicStyles={dynamicStyles} />

        {/* Burnout Risk Section */}
        <Text style={dynamicStyles.sectionHeader}>BURNOUT RISK</Text>

        {/* Burnout Risk Indicator */}
        <BurnoutRiskCard
          risk={metrics.metrics.burnoutRisk}
          recommendations={recommendations}
          onAdjustSettings={navigateToCapacitySettings}
          dynamicStyles={dynamicStyles}
        />

        {/* Recommendations (if unhealthy) */}
        {hasUnhealthy && recommendations.length > 0 && (
          <>
            <Text style={dynamicStyles.sectionHeader}>RECOMMENDATIONS</Text>
            <RecommendationsCard
              recommendations={recommendations}
              onAdjustSettings={navigateToCapacitySettings}
              dynamicStyles={dynamicStyles}
            />
          </>
        )}

        {/* Last updated timestamp */}
        <Text style={[styles.lastUpdated, dynamicStyles.lastUpdated]}>
          Last updated: {new Date(metrics.createdAt.toDate()).toLocaleString()}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Health Score Badge Component
 * Displays visual badge based on score
 */
function HealthScoreBadge({ score }: { score: number }) {
  let badge = '';
  let badgeColor = '';
  let badgeText = '';

  if (score >= 80) {
    badge = '✅';
    badgeColor = '#10B981';
    badgeText = 'Excellent';
  } else if (score >= 60) {
    badge = '⚠️';
    badgeColor = '#F59E0B';
    badgeText = 'Good';
  } else {
    badge = '❌';
    badgeColor = '#EF4444';
    badgeText = 'Needs Attention';
  }

  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.badgeIcon}>{badge}</Text>
      <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
    </View>
  );
}

/**
 * Metric Card Props
 */
interface MetricCardProps {
  title: string;
  value: string;
  target: number;
  description: string;
  icon: string;
  status: 'healthy' | 'at_risk' | 'unhealthy';
  trend?: number;
  invertTrend?: boolean; // For metrics where lower is better
  dynamicStyles: any;
}

/**
 * Metric Card Component
 * Displays individual engagement metric with status and trend
 */
function MetricCard({
  title,
  value,
  target,
  description,
  icon,
  status,
  trend,
  invertTrend = false,
  dynamicStyles,
}: MetricCardProps) {
  const statusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);

  return (
    <View style={[styles.metricCard, dynamicStyles.metricCard]}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricIcon}>{icon}</Text>
        <Text style={[styles.metricTitle, dynamicStyles.metricTitle]}>{title}</Text>
        <Text style={styles.statusIcon}>{statusIcon}</Text>
      </View>

      <View style={styles.metricValueContainer}>
        <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{value}</Text>
        <Text style={[styles.metricTarget, dynamicStyles.metricTarget]}>
          Target: {target}
          {title.includes('Response Time') ? 'h' : '%'}
        </Text>
      </View>

      <Text style={[styles.metricDescription, dynamicStyles.metricDescription]}>{description}</Text>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBg, dynamicStyles.progressBarBg]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(
                  100,
                  Math.max(0, (parseFloat(value) / target) * 100)
                )}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Trend indicator */}
      {trend !== undefined && trend !== 0 && (
        <Text style={[styles.metricTrend, dynamicStyles.metricTrend]}>
          {getTrendArrow(trend, invertTrend)} {Math.abs(trend).toFixed(1)}
          {title.includes('Response Time') ? 'h' : '%'} from last week
        </Text>
      )}
    </View>
  );
}

/**
 * Capacity Usage Card Component
 */
function CapacityUsageCard({ metrics, dynamicStyles }: { metrics: EngagementMetrics; dynamicStyles: any }) {
  const capacityUsage = metrics.metrics.capacityUsage;
  const status = getCapacityUsageStatus(capacityUsage);
  const statusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);

  return (
    <View style={[styles.metricCard, dynamicStyles.metricCard]}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricIcon}>📊</Text>
        <Text style={[styles.metricTitle, dynamicStyles.metricTitle]}>Capacity Usage</Text>
        <Text style={styles.statusIcon}>{statusIcon}</Text>
      </View>

      <View style={styles.metricValueContainer}>
        <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{capacityUsage}%</Text>
        <Text style={[styles.metricTarget, dynamicStyles.metricTarget]}>Optimal: 60-90%</Text>
      </View>

      <Text style={[styles.metricDescription, dynamicStyles.metricDescription]}>
        Your current capacity utilization level
      </Text>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBg, dynamicStyles.progressBarBg]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(100, capacityUsage)}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Burnout Risk Card Props
 */
interface BurnoutRiskCardProps {
  risk: 'low' | 'medium' | 'high';
  recommendations: Recommendation[];
  onAdjustSettings: () => void;
  dynamicStyles: any;
}

/**
 * Burnout Risk Card Component
 */
function BurnoutRiskCard({
  risk,
  recommendations: _recommendations,
  onAdjustSettings,
  dynamicStyles,
}: BurnoutRiskCardProps) {
  const config = {
    low: {
      icon: '✅',
      color: '#10B981',
      title: 'Low Burnout Risk',
      description: "You're maintaining healthy engagement patterns!",
    },
    medium: {
      icon: '⚠️',
      color: '#F59E0B',
      title: 'Medium Burnout Risk',
      description: 'Some metrics need attention. Consider adjusting your capacity.',
    },
    high: {
      icon: '❌',
      color: '#EF4444',
      title: 'High Burnout Risk',
      description:
        "You're at risk of burning out. Please reduce your daily capacity or take a rest day.",
    },
  };

  const riskConfig = config[risk];

  return (
    <View style={[styles.burnoutCard, dynamicStyles.burnoutCard, { borderColor: riskConfig.color }]}>
      <View style={styles.burnoutHeader}>
        <Text style={styles.burnoutIcon}>{riskConfig.icon}</Text>
        <Text style={[styles.burnoutTitle, dynamicStyles.burnoutTitle]}>{riskConfig.title}</Text>
      </View>

      <Text style={[styles.burnoutDescription, dynamicStyles.burnoutDescription]}>{riskConfig.description}</Text>

      {risk === 'high' && (
        <TouchableOpacity
          style={[styles.adjustButton, { backgroundColor: riskConfig.color }]}
          onPress={onAdjustSettings}
        >
          <Text style={styles.adjustButtonText}>Adjust Capacity Settings</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Recommendation interface
 */
interface Recommendation {
  text: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Recommendations Card Props
 */
interface RecommendationsCardProps {
  recommendations: Recommendation[];
  onAdjustSettings: () => void;
  dynamicStyles: any;
}

/**
 * Recommendations Card Component
 */
function RecommendationsCard({
  recommendations,
  onAdjustSettings: _onAdjustSettings,
  dynamicStyles,
}: RecommendationsCardProps) {
  return (
    <View style={[styles.recommendationsCard, dynamicStyles.recommendationsCard]}>
      <Text style={[styles.recommendationsTitle, dynamicStyles.recommendationsTitle]}>💡 Recommendations</Text>
      {recommendations.map((rec, index) => (
        <View key={index} style={styles.recommendationItem}>
          <Text style={[styles.recommendationBullet, dynamicStyles.recommendationBullet]}>•</Text>
          <Text style={[styles.recommendationText, dynamicStyles.recommendationText]}>{rec.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(metrics: EngagementMetrics): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Low personal response rate (< 60%)
  if (metrics.metrics.personalResponseRate < 60) {
    recommendations.push({
      text: 'Edit AI drafts more frequently to maintain authentic engagement',
      action: 'adjust_editing',
      priority: 'high',
    });
  }

  // Slow response times (> 48h)
  if (metrics.metrics.avgResponseTime > 48) {
    recommendations.push({
      text: 'Response times are increasing. Consider lowering your daily capacity',
      action: 'lower_capacity',
      priority: 'medium',
    });
  }

  // Low conversation depth (< 25%)
  if (metrics.metrics.conversationDepth < 25) {
    recommendations.push({
      text: 'Few multi-turn conversations. Try asking more questions to continue dialogue',
      action: 'improve_depth',
      priority: 'low',
    });
  }

  // High capacity usage (> 90%)
  if (metrics.metrics.capacityUsage > 90) {
    recommendations.push({
      text: 'Running at high capacity. Consider reducing daily limit to avoid burnout',
      action: 'reduce_capacity',
      priority: 'high',
    });
  }

  // High burnout risk
  if (metrics.metrics.burnoutRisk === 'high') {
    recommendations.push({
      text: 'High burnout risk detected. Take a rest day or reduce daily capacity',
      action: 'reduce_burnout',
      priority: 'high',
    });
  }

  return recommendations;
}

/**
 * Check if metrics have unhealthy values
 */
function hasUnhealthyMetrics(metrics: EngagementMetrics): boolean {
  return (
    metrics.metrics.personalResponseRate < 60 ||
    metrics.metrics.avgResponseTime > 48 ||
    metrics.metrics.conversationDepth < 25 ||
    metrics.metrics.capacityUsage > 90 ||
    metrics.metrics.burnoutRisk === 'high' ||
    metrics.metrics.burnoutRisk === 'medium'
  );
}

/**
 * Get metric status based on value and thresholds
 */
function getMetricStatus(
  value: number,
  healthyThreshold: number,
  atRiskThreshold: number
): 'healthy' | 'at_risk' | 'unhealthy' {
  if (value >= healthyThreshold) return 'healthy';
  if (value >= atRiskThreshold) return 'at_risk';
  return 'unhealthy';
}

/**
 * Get response time status (inverted thresholds)
 */
function getResponseTimeStatus(hours: number): 'healthy' | 'at_risk' | 'unhealthy' {
  if (hours < 24) return 'healthy';
  if (hours <= 48) return 'at_risk';
  return 'unhealthy';
}

/**
 * Get capacity usage status
 */
function getCapacityUsageStatus(usage: number): 'healthy' | 'at_risk' | 'unhealthy' {
  if (usage >= 60 && usage <= 90) return 'healthy';
  if ((usage >= 40 && usage < 60) || (usage > 90 && usage < 100)) return 'at_risk';
  return 'unhealthy';
}

/**
 * Get status icon
 */
function getStatusIcon(status: 'healthy' | 'at_risk' | 'unhealthy'): string {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'at_risk':
      return '⚠️';
    case 'unhealthy':
      return '❌';
  }
}

/**
 * Get status color
 */
function getStatusColor(status: 'healthy' | 'at_risk' | 'unhealthy'): string {
  switch (status) {
    case 'healthy':
      return '#10B981';
    case 'at_risk':
      return '#F59E0B';
    case 'unhealthy':
      return '#EF4444';
  }
}

/**
 * Get trend arrow
 */
function getTrendArrow(trend: number, invert: boolean = false): string {
  const isPositive = invert ? trend < 0 : trend > 0;
  return isPositive ? '↑' : '↓';
}

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
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'left',
    lineHeight: 22,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 300,
  },
  healthScoreCard: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  healthScoreLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  healthScoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  trendText: {
    fontSize: 14,
    marginTop: 4,
  },
  metricCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  metricTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusIcon: {
    fontSize: 20,
  },
  metricValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  metricTarget: {
    fontSize: 14,
  },
  metricDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  metricTrend: {
    fontSize: 12,
  },
  burnoutCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  burnoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  burnoutIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  burnoutTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  burnoutDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  adjustButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  adjustButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recommendationsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  recommendationBullet: {
    fontSize: 16,
    marginRight: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  lastUpdated: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
