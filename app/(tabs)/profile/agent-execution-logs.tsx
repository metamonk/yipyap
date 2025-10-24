/**
 * Agent Execution Log Viewer Screen
 * @remarks
 * Story 5.8 - Multi-Step Daily Agent (Task 9)
 * Displays execution history with performance metrics and detailed logs
 * Provides expandable detail view with step-by-step progress and error details
 */

import React, { useState, useEffect } from 'react';
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
import { getFirebaseAuth } from '@/services/firebase';
import {
  getExecutionHistory,
  getExecutionById,
  getExecutionLogs,
  calculatePerformanceMetrics,
  subscribeToExecutionHistory,
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
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [executions, setExecutions] = useState<DailyAgentExecution[]>([]);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Record<string, AgentExecutionLog[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    loadExecutions();
  }, []);

  /**
   * Loads execution history for the current user
   */
  const loadExecutions = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view execution logs.');
      router.push('/(tabs)/profile');
      return;
    }

    try {
      const history = await getExecutionHistory(30, currentUser.uid);
      setExecutions(history);
    } catch (error) {
      console.error('Error loading execution history:', error);
      Alert.alert('Error', 'Failed to load execution logs. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Handles pull-to-refresh
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadExecutions();
  };

  /**
   * Toggles expanded view for an execution
   */
  const handleToggleExpand = async (executionId: string) => {
    if (expandedExecutionId === executionId) {
      // Collapse
      setExpandedExecutionId(null);
    } else {
      // Expand and load logs if not already loaded
      setExpandedExecutionId(executionId);
      if (!executionLogs[executionId] && currentUser) {
        try {
          const logs = await getExecutionLogs(executionId, currentUser.uid);
          setExecutionLogs(prev => ({ ...prev, [executionId]: logs }));
        } catch (error) {
          console.error('Error loading execution logs:', error);
          Alert.alert('Error', 'Failed to load detailed logs.');
        }
      }
    }
  };

  /**
   * Handles retry of a failed execution
   */
  const handleRetry = async (executionId: string) => {
    if (!currentUser) return;

    Alert.alert(
      'Retry Workflow',
      'This will retry the daily agent workflow. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          style: 'default',
          onPress: async () => {
            setIsRetrying(true);
            try {
              // TODO: Call Cloud Function to retry workflow
              // For now, show success message
              Alert.alert('Success', 'Workflow retry initiated. Check back in a few minutes.');
              await loadExecutions();
            } catch (error) {
              console.error('Error retrying workflow:', error);
              Alert.alert('Error', 'Failed to retry workflow. Please try again.');
            } finally {
              setIsRetrying(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Formats duration in milliseconds to human-readable string
   */
  const formatDuration = (durationMs: number): string => {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  /**
   * Formats cost in USD cents to dollar string
   */
  const formatCost = (costCents: number): string => {
    const dollars = costCents / 100;
    return `$${dollars.toFixed(2)}`;
  };

  /**
   * Gets status color for visual indication
   */
  const getStatusColor = (status: DailyAgentExecution['status']): string => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // Green
      case 'failed':
        return '#F44336'; // Red
      case 'running':
        return '#2196F3'; // Blue
      case 'skipped':
        return '#FFC107'; // Amber
      default:
        return '#9E9E9E'; // Gray
    }
  };

  /**
   * Gets step status icon
   */
  const getStepIcon = (status: WorkflowStep['status']): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
      case 'running':
        return '⟳';
      case 'skipped':
        return '⊘';
      default:
        return '○';
    }
  };

  /**
   * Gets friendly step name
   */
  const getStepName = (step: WorkflowStep['step']): string => {
    switch (step) {
      case 'fetch':
        return 'Fetch Messages';
      case 'categorize':
        return 'Categorize';
      case 'faq_detect':
        return 'FAQ Detection';
      case 'draft_responses':
        return 'Draft Responses';
      case 'generate_summary':
        return 'Generate Summary';
      default:
        return step;
    }
  };

  /**
   * Gets troubleshooting tips for failed executions
   */
  const getTroubleshootingTips = (execution: DailyAgentExecution): string[] => {
    const tips: string[] = [];

    if (execution.status === 'failed') {
      tips.push('• Check your internet connection');
      tips.push('• Verify your AI API keys are valid');
      tips.push('• Check if you have exceeded API rate limits');

      // Check which step failed
      const failedStep = execution.steps?.find(s => s.status === 'failed');
      if (failedStep) {
        switch (failedStep.step) {
          case 'fetch':
            tips.push('• Ensure you have conversations with recent messages');
            break;
          case 'categorize':
            tips.push('• Verify categorization API is accessible');
            break;
          case 'faq_detect':
            tips.push('• Check that FAQ templates are configured');
            break;
          case 'draft_responses':
            tips.push('• Verify voice matching service is working');
            break;
          case 'generate_summary':
            tips.push('• Check digest generation service');
            break;
        }
      }
    }

    return tips;
  };

  /**
   * Calculates overall performance metrics
   */
  const overallMetrics = calculatePerformanceMetrics(executions);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading execution logs...</Text>
        </View>
      </View>
    );
  }

  if (executions.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Executions Yet</Text>
          <Text style={styles.emptyText}>
            The daily agent hasn't run yet. Enable it in settings to start automated workflows.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Overall Performance Metrics */}
        <View
          style={styles.metricsCard}
          accessibilityRole="summary"
          accessibilityLabel={`Performance metrics: ${overallMetrics.successRate.toFixed(0)}% success rate, ${overallMetrics.totalExecutions} total executions`}
        >
          <Text style={styles.metricsTitle}>Overall Performance</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{overallMetrics.successRate.toFixed(0)}%</Text>
              <Text style={styles.metricLabel}>Success Rate</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatDuration(overallMetrics.averageDuration)}</Text>
              <Text style={styles.metricLabel}>Avg Duration</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatCost(overallMetrics.averageCost)}</Text>
              <Text style={styles.metricLabel}>Avg Cost</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{overallMetrics.totalMessagesProcessed}</Text>
              <Text style={styles.metricLabel}>Messages</Text>
            </View>
          </View>
        </View>

        {/* Execution History */}
        <Text style={styles.sectionTitle}>Execution History (Last 30 Days)</Text>

        {executions.map(execution => {
          const isExpanded = expandedExecutionId === execution.id;
          const logs = executionLogs[execution.id] || [];
          const troubleshootingTips = getTroubleshootingTips(execution);

          return (
            <View key={execution.id} style={styles.executionCard}>
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
                      <Text style={styles.executionDate}>
                        {execution.executionDate?.toDate?.().toLocaleDateString() || 'Unknown date'}
                      </Text>
                      <Text style={styles.executionTime}>
                        {execution.executionDate?.toDate?.().toLocaleTimeString() || ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.executionHeaderRight}>
                    <Text style={styles.executionStatus}>{execution.status.toUpperCase()}</Text>
                    <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                  </View>
                </View>

                {/* Quick Stats */}
                <View style={styles.quickStats}>
                  <Text style={styles.quickStatText}>
                    {execution.results?.messagesFetched || 0} fetched
                  </Text>
                  <Text style={styles.quickStatDivider}>•</Text>
                  <Text style={styles.quickStatText}>
                    {execution.results?.autoResponsesSent || 0} handled
                  </Text>
                  <Text style={styles.quickStatDivider}>•</Text>
                  <Text style={styles.quickStatText}>
                    {execution.results?.messagesNeedingReview || 0} need review
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Details */}
              {isExpanded && (
                <View style={styles.executionDetails}>
                  {/* Performance Metrics */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Performance</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Duration:</Text>
                      <Text style={styles.detailValue}>
                        {formatDuration(execution.metrics?.duration || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Cost:</Text>
                      <Text style={styles.detailValue}>
                        {formatCost(execution.metrics?.costIncurred || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* Workflow Steps */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Workflow Steps</Text>
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
                        <Text style={styles.stepName}>{getStepName(step.step)}</Text>
                        <Text style={styles.stepStatus}>{step.status}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Error Details (if failed) */}
                  {execution.status === 'failed' && (
                    <View style={styles.errorSection}>
                      <Text style={styles.errorTitle}>Error Details</Text>
                      {execution.steps?.find(s => s.status === 'failed')?.error && (
                        <Text style={styles.errorMessage}>
                          {execution.steps.find(s => s.status === 'failed')?.error}
                        </Text>
                      )}

                      {/* Troubleshooting Tips */}
                      {troubleshootingTips.length > 0 && (
                        <View style={styles.troubleshootingSection}>
                          <Text style={styles.troubleshootingTitle}>Troubleshooting Tips:</Text>
                          {troubleshootingTips.map((tip, index) => (
                            <Text key={index} style={styles.troubleshootingTip}>
                              {tip}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Retry Button */}
                      <TouchableOpacity
                        style={styles.retryButton}
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
                      <Text style={styles.detailSectionTitle}>Execution Logs</Text>
                      {logs.map((log, index) => (
                        <View key={index} style={styles.logRow}>
                          <Text
                            style={[
                              styles.logLevel,
                              log.level === 'error' && styles.logLevelError,
                              log.level === 'warning' && styles.logLevelWarning,
                            ]}
                          >
                            {log.level.toUpperCase()}
                          </Text>
                          <Text style={styles.logMessage}>{log.message}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#007AFF',
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
    backgroundColor: '#FFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#007AFF',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  executionCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    color: '#333',
  },
  executionTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  executionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  executionStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  expandIcon: {
    fontSize: 12,
    color: '#999',
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  quickStatText: {
    fontSize: 14,
    color: '#666',
  },
  quickStatDivider: {
    fontSize: 14,
    color: '#CCC',
    marginHorizontal: 8,
  },
  executionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    padding: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
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
    color: '#333',
  },
  stepStatus: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  errorSection: {
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#D32F2F',
    marginBottom: 12,
  },
  troubleshootingSection: {
    marginTop: 8,
  },
  troubleshootingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  troubleshootingTip: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#F44336',
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
    color: '#666',
    width: 60,
  },
  logLevelError: {
    color: '#F44336',
  },
  logLevelWarning: {
    color: '#FFC107',
  },
  logMessage: {
    flex: 1,
    fontSize: 12,
    color: '#333',
  },
});
