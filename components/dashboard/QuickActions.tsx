/**
 * QuickActions - Quick action buttons for bulk operations (Story 5.7 - Task 6)
 *
 * @remarks
 * Provides convenient buttons for common bulk operations:
 * - Archive all read conversations
 * - Mark all messages as read
 * - Batch approve AI suggestions
 *
 * Each action includes confirmation dialogs, progress tracking, and success/error feedback.
 *
 * @example
 * ```tsx
 * <QuickActions userId="user123" />
 * ```
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bulkOperationsService } from '@/services/bulkOperationsService';

/**
 * Props for QuickActions component
 */
export interface QuickActionsProps {
  /** User ID to perform operations for */
  userId: string;

  /** Optional title */
  title?: string;
}

/**
 * QuickActions Component
 */
export function QuickActions({
  userId,
  title = 'Quick Actions',
}: QuickActionsProps) {
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
  const [lastActionTime, setLastActionTime] = useState<number>(0);

  const COOLDOWN_MS = 5000; // 5 seconds cooldown

  /**
   * Check if cooldown period has elapsed
   */
  const canPerformAction = (): boolean => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTime;
    return timeSinceLastAction >= COOLDOWN_MS;
  };

  /**
   * Handle Archive All Read action
   */
  const handleArchiveAllRead = () => {
    if (!canPerformAction()) {
      Alert.alert('Please Wait', 'Please wait a few seconds before performing another action.');
      return;
    }

    Alert.alert(
      'Archive All Read',
      'Are you sure you want to archive all read conversations? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setActiveAction('archive');
            setProgress(null);

            try {
              const result = await bulkOperationsService.archiveAllRead(
                userId,
                (current, total, percentage) => {
                  setProgress({ current, total, percentage });
                }
              );

              setLastActionTime(Date.now());

              if (result.completed) {
                Alert.alert(
                  'Success',
                  `Archived ${result.successCount} conversation${result.successCount !== 1 ? 's' : ''}.`
                );
              } else {
                Alert.alert(
                  'Partial Success',
                  `Archived ${result.successCount} conversations, but ${result.failureCount} failed. ${result.errors[0] || 'Unknown error'}`
                );
              }
            } catch (error) {
              console.error('Error archiving conversations:', error);
              Alert.alert('Error', 'Failed to archive conversations. Please try again.');
            } finally {
              setLoading(false);
              setActiveAction(null);
              setProgress(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle Mark All as Read action
   */
  const handleMarkAllAsRead = () => {
    if (!canPerformAction()) {
      Alert.alert('Please Wait', 'Please wait a few seconds before performing another action.');
      return;
    }

    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all messages as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Read',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            setActiveAction('markRead');
            setProgress(null);

            try {
              const result = await bulkOperationsService.markAllAsRead(
                userId,
                (current, total, percentage) => {
                  setProgress({ current, total, percentage });
                }
              );

              setLastActionTime(Date.now());

              if (result.completed) {
                Alert.alert(
                  'Success',
                  `Marked ${result.successCount} message${result.successCount !== 1 ? 's' : ''} as read.`
                );
              } else {
                Alert.alert(
                  'Partial Success',
                  `Marked ${result.successCount} messages as read, but ${result.failureCount} failed. ${result.errors[0] || 'Unknown error'}`
                );
              }
            } catch (error) {
              console.error('Error marking messages as read:', error);
              Alert.alert('Error', 'Failed to mark messages as read. Please try again.');
            } finally {
              setLoading(false);
              setActiveAction(null);
              setProgress(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle Batch Approve Suggestions action
   */
  const handleBatchApproveSuggestions = () => {
    if (!canPerformAction()) {
      Alert.alert('Please Wait', 'Please wait a few seconds before performing another action.');
      return;
    }

    Alert.alert(
      'Approve All Suggestions',
      'Are you sure you want to approve all pending AI response suggestions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            setActiveAction('approve');
            setProgress(null);

            try {
              const result = await bulkOperationsService.batchApproveSuggestions(
                userId,
                (current, total, percentage) => {
                  setProgress({ current, total, percentage });
                }
              );

              setLastActionTime(Date.now());

              if (result.completed) {
                Alert.alert(
                  'Success',
                  `Approved ${result.successCount} suggestion${result.successCount !== 1 ? 's' : ''}.`
                );
              } else {
                Alert.alert(
                  'Partial Success',
                  `Approved ${result.successCount} suggestions, but ${result.failureCount} failed. ${result.errors[0] || 'Unknown error'}`
                );
              }
            } catch (error) {
              console.error('Error approving suggestions:', error);
              Alert.alert('Error', 'Failed to approve suggestions. Please try again.');
            } finally {
              setLoading(false);
              setActiveAction(null);
              setProgress(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container} accessibilityLabel="Quick actions widget">
      {/* Header */}
      <View style={styles.header}>
        <Ionicons
          name="flash-outline"
          size={20}
          color="#3182CE"
          style={styles.headerIcon}
        />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {/* Progress Indicator */}
      {loading && progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress.percentage}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.current} / {progress.total} ({progress.percentage}%)
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsGrid}>
        {/* Archive All Read */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            loading && activeAction === 'archive' && styles.actionButtonDisabled,
          ]}
          onPress={handleArchiveAllRead}
          disabled={loading}
          accessibilityLabel="Archive all read conversations"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading && activeAction === 'archive' ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Ionicons name="archive-outline" size={24} color="#3182CE" />
          )}
          <Text style={styles.actionButtonText}>Archive Read</Text>
        </TouchableOpacity>

        {/* Mark All as Read */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            loading && activeAction === 'markRead' && styles.actionButtonDisabled,
          ]}
          onPress={handleMarkAllAsRead}
          disabled={loading}
          accessibilityLabel="Mark all messages as read"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading && activeAction === 'markRead' ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Ionicons name="checkmark-done-outline" size={24} color="#38A169" />
          )}
          <Text style={styles.actionButtonText}>Mark All Read</Text>
        </TouchableOpacity>

        {/* Batch Approve Suggestions */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            loading && activeAction === 'approve' && styles.actionButtonDisabled,
          ]}
          onPress={handleBatchApproveSuggestions}
          disabled={loading}
          accessibilityLabel="Batch approve AI suggestions"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading && activeAction === 'approve' ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={24} color="#805AD5" />
          )}
          <Text style={styles.actionButtonText}>Approve Suggestions</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3182CE',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 80,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },
});
