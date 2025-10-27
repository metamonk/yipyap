/**
 * Auto-Archive History Screen with Undo Functionality (Story 6.4)
 * @remarks
 * Displays auto-archived conversations (from capacity system) with 24-hour undo window
 * Shows countdown timer for each undo record
 * Allows bulk or individual undo operations
 * Note: Manual archives appear in the main Messages tab, not here
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import {
  fetchActiveUndoRecords,
  undoArchive,
  getTimeRemainingForUndo,
  formatTimeRemaining,
} from '@/services/undoArchiveService';
import type { UndoArchive } from '@/types/ai';

/**
 * Auto-Archive History Screen Component
 * @component
 */
export default function AutoArchiveHistoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [undoRecords, setUndoRecords] = useState<UndoArchive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingUndo, setProcessingUndo] = useState<Set<string>>(new Set());

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
    backButton: {
      backgroundColor: theme.colors.accent,
    },
    infoBanner: {
      backgroundColor: theme.colors.warningBackground || '#FFF3CD',
      borderLeftColor: theme.colors.warning || '#FFC107',
      borderColor: theme.colors.warningBorder || '#FFE69C',
    },
    infoBannerText: {
      color: theme.colors.warningText || '#856404',
    },
    statsSummary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    statsText: {
      color: theme.colors.textPrimary,
    },
    undoCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    conversationId: {
      color: theme.colors.textPrimary,
    },
    timerBadge: {
      backgroundColor: theme.colors.accentLight || '#E5F0FF',
    },
    timerText: {
      color: theme.colors.accent,
    },
    timerTextExpired: {
      color: theme.colors.error,
    },
    undoCardDetail: {
      color: theme.colors.textSecondary,
    },
    progressBarContainer: {
      backgroundColor: theme.colors.borderLight,
    },
    progressBar: {
      backgroundColor: theme.colors.accent,
    },
    undoButton: {
      backgroundColor: theme.colors.accent,
    },
    undoButtonDisabled: {
      backgroundColor: theme.colors.disabled || '#C7C7CC',
    },
    helpContainer: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    helpTitle: {
      color: theme.colors.textPrimary,
    },
    helpText: {
      color: theme.colors.textSecondary,
    },
  });

  /**
   * Loads active undo records
   */
  const loadUndoRecords = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view archived messages.');
      router.push('/(tabs)/profile');
      return;
    }

    try {
      const records = await fetchActiveUndoRecords(currentUser.uid);
      setUndoRecords(records);
    } catch (error) {
      console.error('Error loading undo records:', error);
      Alert.alert('Error', 'Failed to load archived messages. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser, router]);

  useEffect(() => {
    loadUndoRecords();

    // Refresh every 60 seconds to update countdown timers
    const interval = setInterval(() => {
      setUndoRecords((prev) => [...prev]); // Force re-render
    }, 60000);

    return () => clearInterval(interval);
  }, [loadUndoRecords]);

  /**
   * Handles pull-to-refresh
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUndoRecords();
  };

  /**
   * Handles undo operation
   */
  const handleUndo = async (undoRecord: UndoArchive) => {
    if (!currentUser) return;

    // Add to processing set
    setProcessingUndo((prev) => new Set(prev).add(undoRecord.id));

    try {
      const success = await undoArchive(undoRecord.id, currentUser.uid);

      if (success) {
        Alert.alert('Success', 'Conversation has been restored to your inbox.', [
          {
            text: 'View Conversation',
            onPress: () => router.push(`/(tabs)/conversations/${undoRecord.conversationId}`),
          },
          { text: 'OK', style: 'cancel' },
        ]);

        // Remove from list
        setUndoRecords((prev) => prev.filter((r) => r.id !== undoRecord.id));
      } else {
        Alert.alert(
          'Error',
          'Failed to undo archive. The window may have expired or the record is invalid.'
        );
      }
    } catch (error) {
      console.error('Error undoing archive:', error);
      Alert.alert('Error', 'Failed to undo archive. Please try again.');
    } finally {
      // Remove from processing set
      setProcessingUndo((prev) => {
        const next = new Set(prev);
        next.delete(undoRecord.id);
        return next;
      });
    }
  };

  /**
   * Renders individual undo record
   */
  const renderUndoRecord = (record: UndoArchive) => {
    const timeRemaining = getTimeRemainingForUndo(record);
    const formattedTime = formatTimeRemaining(timeRemaining);
    const isExpired = timeRemaining === 0;
    const isProcessing = processingUndo.has(record.id);

    // Calculate progress percentage
    const totalDuration = 24 * 60 * 60 * 1000; // 24 hours
    const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));

    return (
      <View key={record.id} style={[styles.undoCard, dynamicStyles.undoCard]}>
        {/* Header */}
        <View style={styles.undoCardHeader}>
          <Text style={[styles.conversationId, dynamicStyles.conversationId]}>Conversation ID: {record.conversationId.slice(0, 8)}...</Text>
          <View style={[styles.timerBadge, dynamicStyles.timerBadge]}>
            <Text style={isExpired ? [styles.timerTextExpired, dynamicStyles.timerTextExpired] : [styles.timerText, dynamicStyles.timerText]}>{formattedTime}</Text>
          </View>
        </View>

        {/* Details */}
        <Text style={[styles.undoCardDetail, dynamicStyles.undoCardDetail]}>
          Archived: {record.archivedAt.toDate().toLocaleString()}
        </Text>
        {record.boundaryMessageSent && (
          <Text style={[styles.undoCardDetail, dynamicStyles.undoCardDetail]}>✉️ Kind boundary message sent</Text>
        )}

        {/* Progress Bar */}
        <View style={[styles.progressBarContainer, dynamicStyles.progressBarContainer]}>
          <View style={[styles.progressBar, dynamicStyles.progressBar, { width: `${progressPercent}%` }]} />
        </View>

        {/* Undo Button */}
        <TouchableOpacity
          style={[
            styles.undoButton,
            dynamicStyles.undoButton,
            (isExpired || isProcessing) && dynamicStyles.undoButtonDisabled,
          ]}
          onPress={() => handleUndo(record)}
          disabled={isExpired || isProcessing}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Undo archive for conversation ${record.conversationId}`}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.undoButtonText}>
              {isExpired ? 'Expired' : 'Undo Archive'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader
          title="Auto-Archive History"
          showBack={true}
          backAction={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading archived messages...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (undoRecords.length === 0) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader
          title="Auto-Archive History"
          showBack={true}
          backAction={() => router.back()}
        />
        <View style={styles.emptyContainer} accessible={true} accessibilityRole="text">
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>No Auto-Archived Messages</Text>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
            When conversations are automatically archived by the capacity system, they'll appear here.{'\n\n'}
            You'll have 24 hours to undo any auto-archive.{'\n\n'}
            (Manual archives appear in the Messages tab)
          </Text>
          <TouchableOpacity
            style={[styles.backButton, dynamicStyles.backButton]}
            onPress={() => router.back()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Archived Messages"
        showBack={true}
        backAction={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Page Header */}
        <Text style={[styles.title, dynamicStyles.title]}>Archived Messages</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          View and undo auto-archived conversations within 24 hours
        </Text>

        {/* Info Banner */}
        <View style={[styles.infoBanner, dynamicStyles.infoBanner]}>
          <Text style={[styles.infoBannerText, dynamicStyles.infoBannerText]}>
            ⏰ You have 24 hours to undo auto-archived conversations.{'\n'}
            After that, they'll remain archived.
          </Text>
        </View>

        {/* Stats Summary Section */}
        <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>SUMMARY</Text>
        <View style={[styles.statsSummary, dynamicStyles.statsSummary]}>
          <Text style={[styles.statsText, dynamicStyles.statsText]}>
            {undoRecords.length} conversation{undoRecords.length !== 1 ? 's' : ''} archived
          </Text>
        </View>

        {/* Undo Records Section */}
        <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>ARCHIVED CONVERSATIONS</Text>
        <View style={styles.recordsList}>{undoRecords.map(renderUndoRecord)}</View>

        {/* Help Section */}
        <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>ABOUT AUTO-ARCHIVE</Text>
        <View style={[styles.helpContainer, dynamicStyles.helpContainer]}>
          <Text style={[styles.helpText, dynamicStyles.helpText]}>
            • Messages beyond your daily capacity are auto-archived{'\n'}
            • Kind boundary messages are sent to fans{'\n'}
            • Business, urgent, VIP, and crisis messages are never archived{'\n'}
            • Archived conversations can be manually viewed anytime
          </Text>
        </View>
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
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
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
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBanner: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  infoBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsSummary: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordsList: {
    marginBottom: 16,
  },
  undoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  undoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  conversationId: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  timerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerTextExpired: {
    fontSize: 14,
    fontWeight: '600',
  },
  undoCardDetail: {
    fontSize: 13,
    marginBottom: 6,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    marginVertical: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  undoButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  undoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    padding: 20,
    marginBottom: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
