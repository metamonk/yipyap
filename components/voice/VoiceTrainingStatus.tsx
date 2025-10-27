/**
 * VoiceTrainingStatus component displays voice profile training status
 *
 * @component
 * @remarks
 * Shows current training status, last trained date, and basic metrics.
 * Used in Voice Settings screen to provide visibility into voice matching readiness.
 *
 * @example
 * ```tsx
 * <VoiceTrainingStatus userId="user123" />
 * ```
 */

import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import type { VoiceProfile } from '@/types/ai';

/**
 * Props for the VoiceTrainingStatus component
 */
export interface VoiceTrainingStatusProps {
  /** User ID to display training status for */
  userId: string;

  /** Optional: User's retraining schedule for calculating next retraining date */
  retrainingSchedule?: 'weekly' | 'biweekly' | 'monthly';
}

/**
 * Calculates the next retraining date based on last trained date and schedule
 */
const calculateNextRetrainingDate = (
  lastTrainedAt: Date,
  schedule: 'weekly' | 'biweekly' | 'monthly'
): Date => {
  const nextDate = new Date(lastTrainedAt);

  switch (schedule) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }

  return nextDate;
};

/**
 * Displays voice profile training status and metrics
 *
 * @component
 * @remarks
 * - Shows "Not Trained", "Training", or "Ready" status
 * - Displays training progress (message count / 50 minimum)
 * - Displays last trained date and next retraining date
 * - Real-time updates via Firestore listener
 * - Loading state during initial fetch
 */
export const VoiceTrainingStatus: FC<VoiceTrainingStatusProps> = ({
  userId,
  retrainingSchedule = 'weekly',
}) => {
  const { theme } = useTheme();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    const profileRef = doc(db, 'voice_profiles', userId);

    // Subscribe to voice profile updates
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setVoiceProfile({ id: snapshot.id, ...snapshot.data() } as VoiceProfile);
        } else {
          setVoiceProfile(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading voice profile:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Analytics tracking for satisfaction metrics (Subtask 16.6)
  useEffect(() => {
    if (!voiceProfile || !voiceProfile.metrics || voiceProfile.metrics.totalSuggestionsGenerated === 0) {
      return;
    }

    const metrics = voiceProfile.metrics;
    const acceptanceRate = (metrics.acceptedSuggestions / metrics.totalSuggestionsGenerated) * 100;
    const editRate = metrics.acceptedSuggestions > 0
      ? (metrics.editedSuggestions / metrics.acceptedSuggestions) * 100
      : 0;
    const satisfactionRating = metrics.averageSatisfactionRating || 0;
    const satisfactionPercentage = (satisfactionRating / 5.0) * 100;
    const isBelowThreshold = acceptanceRate < 80 || (satisfactionRating > 0 && satisfactionPercentage < 80);

    // TODO: Replace with proper analytics service (Firebase Analytics, Mixpanel, etc.)
    // For now, using console.log for development tracking
    console.log('[Analytics] Voice Satisfaction Metrics Viewed', {
      userId,
      acceptanceRate: Math.round(acceptanceRate),
      editRate: Math.round(editRate),
      satisfactionRating: satisfactionRating.toFixed(1),
      totalSuggestions: metrics.totalSuggestionsGenerated,
      acceptedSuggestions: metrics.acceptedSuggestions,
      editedSuggestions: metrics.editedSuggestions,
      rejectedSuggestions: metrics.rejectedSuggestions,
      isBelowThreshold,
    });

    // Track low satisfaction alert separately
    if (isBelowThreshold) {
      console.log('[Analytics] Low Satisfaction Alert Shown', {
        userId,
        acceptanceRate: Math.round(acceptanceRate),
        satisfactionRating: satisfactionRating.toFixed(1),
        reason: acceptanceRate < 80
          ? 'low_acceptance_rate'
          : 'low_satisfaction_rating',
      });
    }
  }, [voiceProfile, userId]);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    statusCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    statusLabel: {
      color: theme.colors.textSecondary,
    },
    statusValue: {
      color: theme.colors.textPrimary,
    },
    statusReady: {
      color: theme.colors.success || '#34C759',
    },
    statusNotTrained: {
      color: theme.colors.warning || '#FF9500',
    },
    helpText: {
      color: theme.colors.textSecondary,
    },
    detailLabel: {
      color: theme.colors.textSecondary,
    },
    detailValue: {
      color: theme.colors.textPrimary,
    },
    detailRow: {
      borderTopColor: theme.colors.borderLight,
    },
    progressLabel: {
      color: theme.colors.textSecondary,
    },
    progressText: {
      color: theme.colors.textPrimary,
    },
    progressBarContainer: {
      backgroundColor: theme.colors.borderLight,
    },
    progressBarFill: {
      backgroundColor: theme.colors.accent,
    },
    metricsHeader: {
      borderTopColor: theme.colors.accent,
    },
    metricsHeaderText: {
      color: theme.colors.accent,
    },
    alertContainer: {
      backgroundColor: theme.colors.warningBackground || '#FFF3CD',
      borderColor: theme.colors.warning || '#FFC107',
    },
    alertTitle: {
      color: theme.colors.warningText || '#856404',
    },
    alertMessage: {
      color: theme.colors.warningText || '#856404',
    },
    alertAction: {
      color: theme.colors.warningText || '#856404',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  }

  // Not trained yet or insufficient samples
  if (!voiceProfile || voiceProfile.trainingSampleCount < 50) {
    const sampleCount = voiceProfile?.trainingSampleCount || 0;
    const progress = Math.min((sampleCount / 50) * 100, 100);

    return (
      <View style={styles.container}>
        <View style={[styles.statusCard, dynamicStyles.statusCard]}>
          <Text style={[styles.statusLabel, dynamicStyles.statusLabel]}>Voice Profile Status</Text>
          <Text style={[styles.statusValue, dynamicStyles.statusValue, dynamicStyles.statusNotTrained]}>
            {sampleCount === 0 ? 'Not Trained' : 'In Progress'}
          </Text>

          {/* Training Progress */}
          <View style={styles.progressSection}>
            <Text style={[styles.progressLabel, dynamicStyles.progressLabel]}>Training Progress</Text>
            <Text style={[styles.progressText, dynamicStyles.progressText]}>
              {sampleCount} / 50 messages
            </Text>

            {/* Progress Bar */}
            <View style={[styles.progressBarContainer, dynamicStyles.progressBarContainer]}>
              <View style={[styles.progressBarFill, dynamicStyles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <Text style={[styles.helpText, dynamicStyles.helpText]}>
            {sampleCount === 0
              ? 'Send at least 50 messages to train your voice profile'
              : `Send ${50 - sampleCount} more messages to enable voice matching`}
          </Text>
        </View>
      </View>
    );
  }

  // Format last trained date
  const lastTrainedDate = voiceProfile.lastTrainedAt?.toDate?.() || new Date(voiceProfile.lastTrainedAt as any);
  const formattedDate = lastTrainedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate next retraining date
  const nextRetrainingDate = calculateNextRetrainingDate(lastTrainedDate, retrainingSchedule);
  const formattedNextDate = nextRetrainingDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={[styles.statusCard, dynamicStyles.statusCard]}>
        <Text style={[styles.statusLabel, dynamicStyles.statusLabel]}>Voice Profile Status</Text>
        <Text style={[styles.statusValue, dynamicStyles.statusValue, dynamicStyles.statusReady]}>Ready</Text>

        <View style={[styles.detailRow, dynamicStyles.detailRow]}>
          <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Last Trained</Text>
          <Text style={[styles.detailValue, dynamicStyles.detailValue]}>{formattedDate}</Text>
        </View>

        <View style={[styles.detailRow, dynamicStyles.detailRow]}>
          <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Next Retraining</Text>
          <Text style={[styles.detailValue, dynamicStyles.detailValue]}>{formattedNextDate}</Text>
        </View>

        <View style={[styles.detailRow, dynamicStyles.detailRow]}>
          <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Training Samples</Text>
          <Text style={[styles.detailValue, dynamicStyles.detailValue]}>{voiceProfile.trainingSampleCount}</Text>
        </View>

        {voiceProfile.metrics && (
          <>
            {/* Satisfaction Metrics Section Header */}
            <View style={[styles.metricsHeader, dynamicStyles.metricsHeader]}>
              <Text style={[styles.metricsHeaderText, dynamicStyles.metricsHeaderText]}>Satisfaction Metrics</Text>
            </View>

            <View style={[styles.detailRow, dynamicStyles.detailRow]}>
              <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Total Suggestions Generated</Text>
              <Text style={[styles.detailValue, dynamicStyles.detailValue]}>{voiceProfile.metrics.totalSuggestionsGenerated || 0}</Text>
            </View>

            {voiceProfile.metrics.totalSuggestionsGenerated > 0 && (
              <>
                {/* Acceptance Rate (Subtask 16.1) */}
                <View style={[styles.detailRow, dynamicStyles.detailRow]}>
                  <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Acceptance Rate</Text>
                  <Text style={[styles.detailValue, dynamicStyles.detailValue]}>
                    {Math.round(
                      (voiceProfile.metrics.acceptedSuggestions /
                        voiceProfile.metrics.totalSuggestionsGenerated) *
                        100
                    )}
                    %
                  </Text>
                </View>

                {/* Edit Rate (Subtask 16.2) */}
                {voiceProfile.metrics.acceptedSuggestions > 0 && (
                  <View style={[styles.detailRow, dynamicStyles.detailRow]}>
                    <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Edit Rate</Text>
                    <Text style={[styles.detailValue, dynamicStyles.detailValue]}>
                      {Math.round(
                        (voiceProfile.metrics.editedSuggestions /
                          voiceProfile.metrics.acceptedSuggestions) *
                          100
                      )}
                      %
                    </Text>
                  </View>
                )}

                {/* Satisfaction Rating (Subtask 16.3) */}
                {voiceProfile.metrics.averageSatisfactionRating > 0 && (
                  <View style={[styles.detailRow, dynamicStyles.detailRow]}>
                    <Text style={[styles.detailLabel, dynamicStyles.detailLabel]}>Satisfaction Rating</Text>
                    <Text style={[styles.detailValue, dynamicStyles.detailValue]}>
                      {voiceProfile.metrics.averageSatisfactionRating.toFixed(1)} / 5.0
                    </Text>
                  </View>
                )}

                {/* Low Satisfaction Alert (Subtask 16.5) - AC: 7 requires 80%+ satisfaction */}
                {(() => {
                  const acceptanceRate =
                    (voiceProfile.metrics.acceptedSuggestions /
                      voiceProfile.metrics.totalSuggestionsGenerated) *
                    100;
                  const satisfactionRating = voiceProfile.metrics.averageSatisfactionRating || 0;
                  const satisfactionPercentage = (satisfactionRating / 5.0) * 100;

                  const isBelowThreshold =
                    acceptanceRate < 80 ||
                    (satisfactionRating > 0 && satisfactionPercentage < 80);

                  if (isBelowThreshold) {
                    return (
                      <View style={[styles.alertContainer, dynamicStyles.alertContainer]}>
                        <View style={styles.alertHeader}>
                          <Text style={styles.alertIcon}>⚠️</Text>
                          <Text style={[styles.alertTitle, dynamicStyles.alertTitle]}>Satisfaction Below Target</Text>
                        </View>
                        <Text style={[styles.alertMessage, dynamicStyles.alertMessage]}>
                          {acceptanceRate < 80
                            ? `Your acceptance rate (${Math.round(acceptanceRate)}%) is below our 80% target. `
                            : ''}
                          {satisfactionRating > 0 && satisfactionPercentage < 80
                            ? `Your satisfaction rating (${satisfactionRating.toFixed(1)}/5.0) is below our target. `
                            : ''}
                          Consider retraining your voice profile to improve suggestion quality.
                        </Text>
                        <Text style={[styles.alertAction, dynamicStyles.alertAction]}>
                          Tap "Train Voice Profile Now" above to update your profile.
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  metricsHeader: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
  },
  metricsHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  alertContainer: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  alertAction: {
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
