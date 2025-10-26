/**
 * Daily Digest Review Screen - Meaningful 10
 * @remarks
 * Story 6.1 - Meaningful 10 Daily Digest
 * Displays priority-tiered digest focusing on top 10 most important messages
 * Shows relationship context and capacity-aware prioritization
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
import { NavigationHeader } from '../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import { getMeaningful10Digest } from '@/services/dailyDigestService';
import type { Meaningful10Digest, Meaningful10DigestMessage } from '@/types/ai';

/**
 * Daily Digest Screen Component
 * @component
 *
 * @example
 * ```tsx
 * <DailyDigestScreen />
 * ```
 */
export default function DailyDigestScreen() {
  const router = useRouter();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [digest, setDigest] = useState<Meaningful10Digest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Loads the most recent Meaningful 10 digest
   */
  const loadDigest = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view daily digest.');
      router.push('/(tabs)/profile');
      return;
    }

    try {
      const latestDigest = await getMeaningful10Digest(currentUser.uid);
      setDigest(latestDigest);
    } catch (error) {
      console.error('Error loading Meaningful 10 digest:', error);
      Alert.alert('Error', 'Failed to load daily digest. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser, router]);

  useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  /**
   * Handles pull-to-refresh
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDigest();
  };

  /**
   * Navigates to conversation for message response
   */
  const handleMessageTap = (message: Meaningful10DigestMessage) => {
    router.push(`/(tabs)/conversations/${message.conversationId}`);
  };

  /**
   * Formats relationship context for display
   */
  const formatRelationshipContext = (message: Meaningful10DigestMessage): string => {
    const { relationshipContext } = message;
    const parts: string[] = [];

    if (relationshipContext.isVIP) {
      parts.push('⭐ VIP');
    }

    parts.push(`${relationshipContext.messageCount} messages`);

    if (relationshipContext.conversationAge > 30) {
      parts.push(`${Math.round(relationshipContext.conversationAge / 30)} months`);
    } else {
      parts.push(`${relationshipContext.conversationAge} days`);
    }

    return parts.join(' • ');
  };

  /**
   * Renders individual message card with relationship context
   */
  const renderMessageItem = (message: Meaningful10DigestMessage) => (
    <TouchableOpacity
      key={message.id}
      style={styles.messageCard}
      onPress={() => handleMessageTap(message)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Message scored ${message.relationshipScore}: ${message.content}`}
    >
      {/* Relationship Score Badge */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{Math.round(message.relationshipScore)}</Text>
        </View>
        <Text style={styles.categoryText}>{message.category}</Text>
      </View>

      {/* Message Content */}
      <Text style={styles.messageContent} numberOfLines={3}>
        {message.content}
      </Text>

      {/* Relationship Context */}
      <View style={styles.contextRow}>
        <Text style={styles.contextText}>{formatRelationshipContext(message)}</Text>
      </View>

      {/* Time Estimate */}
      <View style={styles.timeEstimateRow}>
        <Text style={styles.timeEstimateIcon}>⏱</Text>
        <Text style={styles.timeEstimateText}>~{message.estimatedResponseTime} min to respond</Text>
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Daily Digest" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading digest...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!digest) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Meaningful 10" />
        <View style={styles.emptyContainer} accessible={true} accessibilityRole="text">
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No Messages Today</Text>
          <Text style={styles.emptyText}>
            Your daily digest will appear here each morning with your top 10 most important
            messages.
          </Text>
          <Text style={styles.emptyHint}>
            Check back tomorrow or adjust your daily agent settings.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/daily-agent-settings')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go to daily agent settings"
          >
            <Text style={styles.settingsButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader title="Meaningful 10" />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
      >
        {/* Capacity Summary */}
        <View style={styles.capacitySummary}>
          <View style={styles.capacityRow}>
            <Text style={styles.capacityLabel}>Today&apos;s Focus</Text>
            <Text style={styles.capacityValue}>
              {digest.capacityUsed} messages • ~{digest.estimatedTimeCommitment} min
            </Text>
          </View>
        </View>

        {/* High Priority Section */}
        {digest.highPriority.length > 0 && (
          <View style={styles.prioritySection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.priorityIcon, styles.priorityIconHigh]}>
                <Text style={styles.priorityIconText}>🔥</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>High Priority</Text>
                <Text style={styles.sectionSubtitle}>
                  Respond today • Top {digest.highPriority.length}
                </Text>
              </View>
            </View>
            {digest.highPriority.map(renderMessageItem)}
          </View>
        )}

        {/* Medium Priority Section */}
        {digest.mediumPriority.length > 0 && (
          <View style={styles.prioritySection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.priorityIcon, styles.priorityIconMedium]}>
                <Text style={styles.priorityIconText}>📌</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Medium Priority</Text>
                <Text style={styles.sectionSubtitle}>
                  Respond this week • {digest.mediumPriority.length} messages
                </Text>
              </View>
            </View>
            {digest.mediumPriority.map(renderMessageItem)}
          </View>
        )}

        {/* Auto-Handled Section */}
        {(digest.autoHandled.faqCount > 0 || digest.autoHandled.archivedCount > 0) && (
          <View style={styles.prioritySection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.priorityIcon, styles.priorityIconAuto]}>
                <Text style={styles.priorityIconText}>✅</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Auto-Handled</Text>
                <Text style={styles.sectionSubtitle}>
                  {digest.autoHandled.faqCount} FAQ responses • {digest.autoHandled.archivedCount}{' '}
                  archived
                </Text>
              </View>
            </View>
            <View style={styles.autoHandledCard}>
              <Text style={styles.autoHandledText}>
                {digest.autoHandled.faqCount} messages received automatic FAQ responses.{'\n'}
                {digest.autoHandled.archivedCount} low-priority messages were archived.
              </Text>
              {digest.autoHandled.boundaryMessageSent && (
                <Text style={styles.autoHandledHint}>
                  ℹ️ Boundary message sent to archived senders
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Empty State - No Messages */}
        {digest.highPriority.length === 0 &&
          digest.mediumPriority.length === 0 &&
          digest.autoHandled.faqCount === 0 &&
          digest.autoHandled.archivedCount === 0 && (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListIcon}>🎉</Text>
              <Text style={styles.emptyListTitle}>All Caught Up!</Text>
              <Text style={styles.emptyListText}>No new messages to handle today.</Text>
            </View>
          )}

        {/* Settings Link */}
        <View style={styles.settingsLink}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile/daily-agent-settings')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Adjust capacity settings"
          >
            <Text style={styles.settingsLinkText}>⚙️ Adjust Capacity Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
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
    color: '#000000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Capacity Summary
  capacitySummary: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  capacityValue: {
    fontSize: 14,
    color: '#666666',
  },
  // Priority Sections
  prioritySection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  priorityIconHigh: {
    backgroundColor: '#FFE5E5',
  },
  priorityIconMedium: {
    backgroundColor: '#E5F0FF',
  },
  priorityIconAuto: {
    backgroundColor: '#E5FFE5',
  },
  priorityIconText: {
    fontSize: 20,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  // Message Cards
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryText: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'capitalize',
  },
  messageContent: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
    marginBottom: 12,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contextText: {
    fontSize: 13,
    color: '#666666',
  },
  timeEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeEstimateIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  timeEstimateText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  // Auto-Handled Card
  autoHandledCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  autoHandledText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  autoHandledHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
  // Empty List State
  emptyListContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyListIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyListTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyListText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Settings Link
  settingsLink: {
    padding: 24,
    alignItems: 'center',
  },
  settingsLinkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
