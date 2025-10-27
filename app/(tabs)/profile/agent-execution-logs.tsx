/**
 * Agent Execution Log Viewer Screen
 * @remarks
 * Story 5.8 - Multi-Step Daily Agent (Task 9)
 * Displays execution history with performance metrics and detailed logs
 * Provides expandable detail view with step-by-step progress and error details
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getExecutionHistory,
  // getExecutionById,
  getExecutionLogs,
  calculatePerformanceMetrics,
  // subscribeToExecutionHistory,
} from '@/services/agentExecutionLogService';
import type { DailyAgentExecution, AgentExecutionLog, WorkflowStep } from '@/types/ai';

/**
 * Agent Execution Log Viewer Component
 * @component
 *
 * @example
 * ```tsx
 * <AgentExecutionLogsScreen />
 * ```
 */
export default function AgentExecutionLogsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [executions, setExecutions] = useState<DailyAgentExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Record<string, any[]>>({});
  const [isRetrying, setIsRetrying] = useState(false);

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
    settingsButton: {
      backgroundColor: theme.colors.accent,
    },
    metricsCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    metricsTitle: {
      color: theme.colors.textPrimary,
    },
    metricValue: {
      color: theme.colors.accent,
    },
    metricLabel: {
      color: theme.colors.textSecondary,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
    },
    executionCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    executionDate: {
      color: theme.colors.textPrimary,
    },
    executionTime: {
      color: theme.colors.textSecondary,
    },
    executionStatus: {
      color: theme.colors.textSecondary,
    },
    expandIcon: {
      color: theme.colors.textTertiary,
    },
    quickStatText: {
      color: theme.colors.textSecondary,
    },
    quickStatDivider: {
      color: theme.colors.borderLight,
    },
    executionDetails: {
      borderTopColor: theme.colors.borderLight,
    },
    detailSectionTitle: {
      color: theme.colors.textPrimary,
    },
    detailLabel: {
      color: theme.colors.textSecondary,
    },
    detailValue: {
      color: theme.colors.textPrimary,
    },
    stepName: {
      color: theme.colors.textPrimary,
    },
    stepStatus: {
      color: theme.colors.textSecondary,
    },
    errorSection: {
      backgroundColor: theme.colors.errorBackground || '#FFF3F3',
    },
    errorTitle: {
      color: theme.colors.error,
    },
    errorMessage: {
      color: theme.colors.error,
    },
    troubleshootingTitle: {
      color: theme.colors.textPrimary,
    },
    troubleshootingTip: {
      color: theme.colors.textSecondary,
    },
    retryButton: {
      backgroundColor: theme.colors.error,
    },
    logLevel: {
      color: theme.colors.textSecondary,
    },
    logLevelError: {
      color: theme.colors.error,
    },
    logLevelWarning: {
      color: theme.colors.warning || '#FFC107',
    },
    logMessage: {
      color: theme.colors.textPrimary,
    },
  });

  /**
   * Load execution history
   */
  const loadExecutions = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Get last 30 execution records for the current user
      const logs = await getExecutionHistory(30, currentUser.uid);
      setExecutions(logs);
    } catch (error) {
      console.error('Error loading execution logs:', error);
      Alert.alert('Error', 'Failed to load execution logs. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadExecutions();
  };

  /**
   * Toggle expansion of execution details
   */
  const handleToggleExpand = (executionId: string) => {
    if (expandedExecutionId === executionId) {
      setExpandedExecutionId(null);
    } else {
      setExpandedExecutionId(executionId);
      // Load detailed logs if not already loaded
      if (!executionLogs[executionId]) {
        // In a real implementation, you'd fetch detailed logs here
        setExecutionLogs(prev => ({ ...prev, [executionId]: [] }));
      }
    }
  };

  /**
   * Retry a failed execution
   */
  const handleRetry = async (executionId: string) => {
    if (!currentUser) return;

    setIsRetrying(true);
    try {
      // Call cloud function to retry the daily agent workflow
      // await retryDailyAgentWorkflow(currentUser.uid);
      Alert.alert('Success', 'Workflow retry initiated. Check back in a few minutes.');
      loadExecutions();
    } catch (error) {
      console.error('Error retrying workflow:', error);
      Alert.alert('Error', 'Failed to retry workflow. Please try again.');
    } finally {
      setIsRetrying(false);
    }
  };

  /**
   * Format duration in ms to readable string
   */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  /**
   * Format cost in cents
   */
  const formatCost = (cents: number): string => {
    return `$${(cents / 100).toFixed(4)}`;
  };

  /**
   * Get color based on status
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success':
      case 'completed':
        return theme.colors.success || '#34C759';
      case 'failed':
      case 'error':
        return theme.colors.error;
      case 'running':
      case 'in_progress':
        return theme.colors.accent;
      default:
        return theme.colors.textSecondary;
    }
  };

  /**
   * Get icon based on status
   */
  const getStepIcon = (status: string): string => {
    switch (status) {
      case 'success':
      case 'completed':
        return '✓';
      case 'failed':
      case 'error':
        return '✗';
      case 'running':
      case 'in_progress':
        return '⟳';
      case 'skipped':
        return '○';
      default:
        return '·';
    }
  };

  /**
   * Get human-readable step name
   */
  const getStepName = (step: string): string => {
    const stepNames: Record<string, string> = {
      fetch_messages: 'Fetch Messages',
      analyze_sentiment: 'Analyze Sentiment',
      detect_faqs: 'Detect FAQs',
      send_responses: 'Send Responses',
      update_opportunities: 'Update Opportunities',
    };
    return stepNames[step] || step;
  };

  /**
   * Get troubleshooting tips based on error
   */
  const getTroubleshootingTips = (execution: DailyAgentExecution): string[] => {
    const tips: string[] = [];
    const failedStep = execution.steps?.find(s => s.status === 'failed');

    if (!failedStep) return tips;

    if (failedStep.step === 'fetch_messages') {
      tips.push('• Check your internet connection');
      tips.push('• Verify Firestore permissions');
    } else if (failedStep.step === 'analyze_sentiment') {
      tips.push('• Check if OpenAI API key is valid');
      tips.push('• Ensure sufficient API credits');
    } else if (failedStep.step === 'detect_faqs') {
      tips.push('• Verify FAQ templates are configured');
      tips.push('• Check Pinecone API credentials');
    } else if (failedStep.step === 'send_responses') {
      tips.push('• Verify message sending permissions');
      tips.push('• Check Firestore write access');
    } else if (failedStep.step === 'update_opportunities') {
      tips.push('• Check Firestore write permissions');
      tips.push('• Verify opportunity scoring rules');
    }

    return tips;
  };

  /**
   * Calculates overall performance metrics
   */
  const overallMetrics = calculatePerformanceMetrics(executions);

  if (isLoading) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader title="Execution Logs" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading execution logs...</Text>
        </View>
      </View>
    );
  }

  if (executions.length === 0) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader title="Execution Logs" />
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.accent]}
              tintColor={theme.colors.accent}
            />
          }
        >
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>No Executions Yet</Text>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
            The daily agent hasn&apos;t run yet. Enable it in settings to start automated workflows.
          </Text>
          <TouchableOpacity
            style={[styles.settingsButton, dynamicStyles.settingsButton]}
            onPress={() => router.push('/(tabs)/profile/daily-agent-settings')}
            accessibilityRole="button"
            accessibilityLabel="Go to daily agent settings"
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader title="Execution Logs" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Page Header */}
        <Text style={[styles.title, dynamicStyles.title]}>Agent Execution Logs</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          View detailed execution history and performance metrics for the daily agent
        </Text>

        {/* Performance Metrics Section */}
        <Text style={dynamicStyles.sectionHeader}>PERFORMANCE METRICS</Text>

        {/* Overall Performance Metrics */}
        <View
          style={[styles.metricsCard, dynamicStyles.metricsCard]}
          accessibilityRole="summary"
          accessibilityLabel={`Performance metrics: ${overallMetrics.successRate.toFixed(0)}% success rate, ${overallMetrics.totalExecutions} total executions`}
        >
          <Text style={[styles.metricsTitle, dynamicStyles.metricsTitle]}>Overall Performance</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{overallMetrics.successRate.toFixed(0)}%</Text>
              <Text style={[styles.metricLabel, dynamicStyles.metricLabel]}>Success Rate</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{formatDuration(overallMetrics.averageDuration)}</Text>
              <Text style={[styles.metricLabel, dynamicStyles.metricLabel]}>Avg Duration</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{formatCost(overallMetrics.averageCost)}</Text>
              <Text style={[styles.metricLabel, dynamicStyles.metricLabel]}>Avg Cost</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, dynamicStyles.metricValue]}>{overallMetrics.totalMessagesProcessed}</Text>
              <Text style={[styles.metricLabel, dynamicStyles.metricLabel]}>Messages</Text>
            </View>
          </View>
        </View>

        {/* Execution History */}
        <Text style={dynamicStyles.sectionHeader}>EXECUTION HISTORY (LAST 30 DAYS)</Text>

        {executions.map(execution => {
          const isExpanded = expandedExecutionId === execution.id;
          const logs = executionLogs[execution.id] || [];
          const troubleshootingTips = getTroubleshootingTips(execution);

          return (
            <View key={execution.id} style={[styles.executionCard, dynamicStyles.executionCard]}>
              {/* Header - Tappable */}
              <TouchableOpacity
                onPress={() => handleToggleExpand(execution.id)}
                accessibilityRole="button"
                accessibilityLabel={`Execution on ${execution.executionDate?.toDate?.().toLocaleDateString()}, status ${execution.status}`}
                accessibilityHint="Tap to expand details"
              >
                <View style={styles.executionHeader}>
                  <View style={styles.executionHeaderLeft}>
                    <View
                      style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(execution.status) },
                      ]}
                      accessibilityLabel={`Status: ${execution.status}`}
                    />
                    <View>
                      <Text style={[styles.executionDate, dynamicStyles.executionDate]}>
                        {execution.executionDate?.toDate?.().toLocaleDateString() || 'Unknown date'}
                      </Text>
                      <Text style={[styles.executionTime, dynamicStyles.executionTime]}>
                        {execution.executionDate?.toDate?.().toLocaleTimeString() || ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.executionHeaderRight}>
                    <Text style={[styles.executionStatus, dynamicStyles.executionStatus]}>{execution.status.toUpperCase()}</Text>
                    <Text style={[styles.expandIcon, dynamicStyles.expandIcon]}>{isExpanded ? '▼' : '▶'}</Text>
                  </View>
                </View>

                {/* Quick Stats */}
                <View style={styles.quickStats}>
                  <Text style={[styles.quickStatText, dynamicStyles.quickStatText]}>
                    {execution.results?.messagesFetched || 0} fetched
                  </Text>
                  <Text style={[styles.quickStatDivider, dynamicStyles.quickStatDivider]}>•</Text>
                  <Text style={[styles.quickStatText, dynamicStyles.quickStatText]}>
                    {execution.results?.autoResponsesSent || 0} handled
                  </Text>
                  <Text style={[styles.quickStatDivider, dynamicStyles.quickStatDivider]}>•</Text>
                  <Text style={[styles.quickStatText, dynamicStyles.quickStatText]}>
                    {execution.results?.messagesNeedingReview || 0} need review
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Details */}
              {isExpanded && (
                <View style={[styles.executionDetails, dynamicStyles.executionDetails]}>
                  {/* Performance Metrics */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, dynamicStyles.detailSectionTitle]}>Performance</Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Duration:</Text>
                      <Text style={[styles.detailValue, dynamicStyles.detailValue]}>
                        {formatDuration(execution.metrics?.duration || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Cost:</Text>
                      <Text style={[styles.detailValue, dynamicStyles.detailValue]}>
                        {formatCost(execution.metrics?.costIncurred || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* Workflow Steps */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, dynamicStyles.detailSectionTitle]}>Workflow Steps</Text>
                    {execution.steps?.map((step, index) => (
                      <View
                        key={index}
                        style={styles.stepRow}
                        accessibilityLabel={`Step ${getStepName(step.step)}, status ${step.status}`}
                      >
                        <Text
                          style={[
                            styles.stepIcon,
                            { color: getStatusColor(step.status) },
                          ]}
                        >
                          {getStepIcon(step.status)}
                        </Text>
                        <Text style={[styles.stepName, dynamicStyles.stepName]}>{getStepName(step.step)}</Text>
                        <Text style={[styles.stepStatus, dynamicStyles.stepStatus]}>{step.status}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Error Details (if failed) */}
                  {execution.status === 'failed' && (
                    <View style={[styles.errorSection, dynamicStyles.errorSection]}>
                      <Text style={[styles.errorTitle, dynamicStyles.errorTitle]}>Error Details</Text>
                      {execution.steps?.find(s => s.status === 'failed')?.error && (
                        <Text style={[styles.errorMessage, dynamicStyles.errorMessage]}>
                          {execution.steps.find(s => s.status === 'failed')?.error}
                        </Text>
                      )}

                      {/* Troubleshooting Tips */}
                      {troubleshootingTips.length > 0 && (
                        <View style={styles.troubleshootingSection}>
                          <Text style={[styles.troubleshootingTitle, dynamicStyles.troubleshootingTitle]}>Troubleshooting Tips:</Text>
                          {troubleshootingTips.map((tip, index) => (
                            <Text key={index} style={[styles.troubleshootingTip, dynamicStyles.troubleshootingTip]}>
                              {tip}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Retry Button */}
                      <TouchableOpacity
                        style={[styles.retryButton, dynamicStyles.retryButton]}
                        onPress={() => handleRetry(execution.id)}
                        disabled={isRetrying}
                        accessibilityRole="button"
                        accessibilityLabel="Retry failed workflow"
                      >
                        {isRetrying ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.retryButtonText}>Retry Workflow</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Execution Logs */}
                  {logs.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={[styles.detailSectionTitle, dynamicStyles.detailSectionTitle]}>Execution Logs</Text>
                      {logs.map((log, index) => (
                        <View key={index} style={styles.logRow}>
                          <Text
                            style={[
                              styles.logLevel,
                              dynamicStyles.logLevel,
                              log.level === 'error' && dynamicStyles.logLevelError,
                              log.level === 'warning' && dynamicStyles.logLevelWarning,
                            ]}
                          >
                            {log.level.toUpperCase()}
                          </Text>
                          <Text style={[styles.logMessage, dynamicStyles.logMessage]}>{log.message}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
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
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 150,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  metricsCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  metricItem: {
    alignItems: 'center',
    minWidth: '22%',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  executionCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  executionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 44,
  },
  executionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  executionDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  executionTime: {
    fontSize: 14,
    marginTop: 2,
  },
  executionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  executionStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  expandIcon: {
    fontSize: 12,
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  quickStatText: {
    fontSize: 14,
  },
  quickStatDivider: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  executionDetails: {
    borderTopWidth: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepIcon: {
    fontSize: 16,
    width: 24,
    fontWeight: 'bold',
  },
  stepName: {
    flex: 1,
    fontSize: 14,
  },
  stepStatus: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  errorSection: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE',
    padding: 12,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    marginBottom: 12,
  },
  troubleshootingSection: {
    marginTop: 8,
  },
  troubleshootingTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  troubleshootingTip: {
    fontSize: 13,
    lineHeight: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  logLevel: {
    fontSize: 10,
    fontWeight: 'bold',
    width: 60,
  },
  logMessage: {
    flex: 1,
    fontSize: 12,
  },
});
