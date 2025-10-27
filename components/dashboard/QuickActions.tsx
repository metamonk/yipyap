/**
 * QuickActions - Quick action buttons for bulk operations (Story 5.7 - Task 6)
 *
 * @remarks
 * Provides convenient buttons for common bulk operations:
 * - Archive all read conversations
 * - Mark all messages as read
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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
  const [lastActionTime, setLastActionTime] = useState<number>(0);

  const COOLDOWN_MS = 5000; // 5 seconds cooldown

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
    },
    progressBar: {
      backgroundColor: theme.colors.borderLight,
    },
    progressFill: {
      backgroundColor: theme.colors.accent,
    },
    progressText: {
      color: theme.colors.textSecondary,
    },
    actionButton: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderColor: theme.colors.borderLight,
    },
    actionButtonText: {
      color: theme.colors.textPrimary,
    },
  });

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


  return (
    <View style={[styles.container, dynamicStyles.container]} accessibilityLabel="Quick actions widget">
      {/* Header - Minimal design without icon */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>{title}</Text>
      </View>

      {/* Progress Indicator */}
      {loading && progress && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, dynamicStyles.progressBar]}>
            <View
              style={[styles.progressFill, dynamicStyles.progressFill, { width: `${progress.percentage}%` }]}
            />
          </View>
          <Text style={[styles.progressText, dynamicStyles.progressText]}>
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
            dynamicStyles.actionButton,
            loading && activeAction === 'archive' && styles.actionButtonDisabled,
          ]}
          onPress={handleArchiveAllRead}
          disabled={loading}
          accessibilityLabel="Archive all read conversations"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading && activeAction === 'archive' ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <Ionicons name="archive-outline" size={24} color={theme.colors.accent} />
          )}
          <Text style={[styles.actionButtonText, dynamicStyles.actionButtonText]}>Archive Read</Text>
        </TouchableOpacity>

        {/* Mark All as Read */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            dynamicStyles.actionButton,
            loading && activeAction === 'markRead' && styles.actionButtonDisabled,
          ]}
          onPress={handleMarkAllAsRead}
          disabled={loading}
          accessibilityLabel="Mark all messages as read"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading && activeAction === 'markRead' ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <Ionicons name="checkmark-done-outline" size={24} color={theme.colors.accent} />
          )}
          <Text style={[styles.actionButtonText, dynamicStyles.actionButtonText]}>Mark All Read</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 80,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
