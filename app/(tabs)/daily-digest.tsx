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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigation } from '@/hooks/useNavigation';
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
  const { goToProfile, goToConversation, goToProfileSettings, ROUTES } = useNavigation();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;
  const { theme } = useTheme();

  const [digest, setDigest] = useState<Meaningful10Digest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoHandledExpanded, setAutoHandledExpanded] = useState(false); // Story 6.4: Collapsible auto-handled section

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
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
      color: theme.colors.textTertiary,
    },
    settingsButton: {
      backgroundColor: theme.colors.accent,
    },
    capacitySummary: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    capacityLabel: {
      color: theme.colors.textPrimary,
    },
    capacityValue: {
      color: theme.colors.textSecondary,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
    },
    sectionSubtitle: {
      color: theme.colors.textSecondary,
    },
    messageCard: {
      backgroundColor: theme.colors.surface,
      ...theme.shadows.sm,
    },
    scoreBadge: {
      backgroundColor: theme.colors.accent,
    },
    categoryText: {
      color: theme.colors.textSecondary,
    },
    senderName: {
      color: theme.colors.textPrimary,
    },
    messageContent: {
      color: theme.colors.textPrimary,
    },
    contextText: {
      color: theme.colors.textSecondary,
    },
    timeEstimateText: {
      color: theme.colors.textTertiary,
    },
    autoHandledCard: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    autoHandledText: {
      color: theme.colors.textSecondary,
    },
    expandButton: {
      backgroundColor: theme.colors.accent,
    },
    autoHandledExpandedCard: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    autoHandledSectionTitle: {
      color: theme.colors.textPrimary,
    },
    autoHandledSectionText: {
      color: theme.colors.textSecondary,
    },
    viewArchivedButton: {
      backgroundColor: theme.colors.accent,
    },
    collapseButton: {
      borderTopColor: theme.colors.borderLight,
    },
    collapseButtonText: {
      color: theme.colors.accent,
    },
    emptyListTitle: {
      color: theme.colors.textPrimary,
    },
    emptyListText: {
      color: theme.colors.textTertiary,
    },
    settingsLinkText: {
      color: theme.colors.accent,
    },
    expandIcon: {
      color: theme.colors.textSecondary,
    },
  });

  /**
   * Loads the most recent Meaningful 10 digest
   */
  const loadDigest = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view daily digest.');
      goToProfile();
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
  }, [currentUser, goToProfile]);

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
    goToConversation(message.conversationId);
  };

  /**
   * Formats relationship context for display
   */
  const formatRelationshipContext = (message: Meaningful10DigestMessage): string => {
    const { relationshipContext } = message;
    const parts: string[] = [];

    if (relationshipContext.isVIP) {
      parts.push('VIP');
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
      style={[styles.messageCard, dynamicStyles.messageCard]}
      onPress={() => handleMessageTap(message)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Message scored ${message.relationshipScore}: ${message.content}`}
    >
      {/* Relationship Score Badge */}
      <View style={styles.scoreContainer}>
        <View style={[styles.scoreBadge, dynamicStyles.scoreBadge]}>
          <Text style={styles.scoreText}>{Math.round(message.relationshipScore)}</Text>
        </View>
        <Text style={[styles.categoryText, dynamicStyles.categoryText]}>{message.category}</Text>
      </View>

      {/* Sender Name */}
      <Text style={[styles.senderName, dynamicStyles.senderName]}>{message.senderName}</Text>

      {/* Message Content */}
      <Text style={[styles.messageContent, dynamicStyles.messageContent]} numberOfLines={3}>
        {message.content}
      </Text>

      {/* Relationship Context */}
      <View style={styles.contextRow}>
        <Text style={[styles.contextText, dynamicStyles.contextText]}>{formatRelationshipContext(message)}</Text>
      </View>

      {/* Time Estimate */}
      <View style={styles.timeEstimateRow}>
        <Ionicons name="time-outline" size={14} color={theme.colors.textTertiary} style={{ marginRight: 4 }} />
        <Text style={[styles.timeEstimateText, dynamicStyles.timeEstimateText]}>~{message.estimatedResponseTime} min to respond</Text>
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <NavigationHeader
          title="Daily Digest"
          rightAction={{
            icon: 'settings-outline',
            onPress: () => goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading digest...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!digest) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <NavigationHeader
          title="Daily"
          rightAction={{
            icon: 'settings-outline',
            onPress: () => goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS),
          }}
        />
        <View style={styles.emptyContainer} accessible={true} accessibilityRole="text">
          <Ionicons name="mail-outline" size={64} color={theme.colors.textTertiary} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>No Messages Today</Text>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
            Your daily digest will appear here each morning with your top 10 most important
            messages.
          </Text>
          <Text style={[styles.emptyHint, dynamicStyles.emptyHint]}>
            Check back tomorrow or adjust your daily agent settings.
          </Text>
          <TouchableOpacity
            style={[styles.settingsButton, dynamicStyles.settingsButton]}
            onPress={() => goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS)}
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
    <View style={[styles.container, dynamicStyles.container]}>
      <NavigationHeader
        title="Daily"
        rightAction={{
          icon: 'settings-outline',
          onPress: () => goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS + '?from=daily-digest'),
        }}
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
        }
      >
        {/* Capacity Summary */}
        <View style={[styles.capacitySummary, dynamicStyles.capacitySummary]}>
          <View style={styles.capacityRow}>
            <Text style={[styles.capacityLabel, dynamicStyles.capacityLabel]}>Today&apos;s Focus</Text>
            <Text style={[styles.capacityValue, dynamicStyles.capacityValue]}>
              {digest.capacityUsed} messages • ~{digest.estimatedTimeCommitment} min
            </Text>
          </View>
        </View>

        {/* High Priority Section */}
        {digest.highPriority.length > 0 && (
          <View style={styles.prioritySection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>High Priority</Text>
                <Text style={[styles.sectionSubtitle, dynamicStyles.sectionSubtitle]}>
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
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Medium Priority</Text>
                <Text style={[styles.sectionSubtitle, dynamicStyles.sectionSubtitle]}>
                  Respond this week • {digest.mediumPriority.length} messages
                </Text>
              </View>
            </View>
            {digest.mediumPriority.map(renderMessageItem)}
          </View>
        )}

        {/* Auto-Handled Section (Story 6.4: Collapsible) */}
        {(digest.autoHandled.faqCount > 0 || digest.autoHandled.archivedCount > 0) && (
          <View style={styles.prioritySection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setAutoHandledExpanded(!autoHandledExpanded)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Auto-handled section, ${autoHandledExpanded ? 'expanded' : 'collapsed'}, tap to ${autoHandledExpanded ? 'collapse' : 'expand'}`}
            >
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Auto-Handled</Text>
                <Text style={[styles.sectionSubtitle, dynamicStyles.sectionSubtitle]}>
                  {digest.autoHandled.faqCount} FAQ responses • {digest.autoHandled.archivedCount}{' '}
                  archived
                </Text>
              </View>
              <Ionicons
                name={autoHandledExpanded ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Collapsed Summary */}
            {!autoHandledExpanded && (
              <View style={[styles.autoHandledCard, dynamicStyles.autoHandledCard]}>
                <Text style={[styles.autoHandledText, dynamicStyles.autoHandledText]}>
                  {digest.autoHandled.total} messages auto-handled ({digest.autoHandled.faqCount}{' '}
                  FAQ, {digest.autoHandled.archivedCount} archived)
                </Text>
                <TouchableOpacity
                  style={[styles.expandButton, dynamicStyles.expandButton]}
                  onPress={() => setAutoHandledExpanded(true)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Expand to review auto-handled messages"
                >
                  <Text style={styles.expandButtonText}>Expand to Review</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Expanded Details */}
            {autoHandledExpanded && (
              <View style={[styles.autoHandledExpandedCard, dynamicStyles.autoHandledExpandedCard]}>
                {/* FAQ Auto-Responses */}
                {digest.autoHandled.faqCount > 0 && (
                  <View style={styles.autoHandledSection}>
                    <Text style={[styles.autoHandledSectionTitle, dynamicStyles.autoHandledSectionTitle]}>
                      FAQ Auto-Responses ({digest.autoHandled.faqCount})
                    </Text>
                    <Text style={[styles.autoHandledSectionText, dynamicStyles.autoHandledSectionText]}>
                      Automatically responded with FAQ templates. No action needed.
                    </Text>
                  </View>
                )}

                {/* Auto-Archived Messages */}
                {digest.autoHandled.archivedCount > 0 && (
                  <View style={styles.autoHandledSection}>
                    <Text style={[styles.autoHandledSectionTitle, dynamicStyles.autoHandledSectionTitle]}>
                      Auto-Archived ({digest.autoHandled.archivedCount})
                    </Text>
                    <Text style={[styles.autoHandledSectionText, dynamicStyles.autoHandledSectionText]}>
                      Low-priority messages beyond your daily capacity.
                      {digest.autoHandled.archivedCount > 0 &&
                        ' Kind boundary message sent to fans.'}
                    </Text>

                    {/* Link to Archived Messages / Undo */}
                    <TouchableOpacity
                      style={[styles.viewArchivedButton, dynamicStyles.viewArchivedButton]}
                      onPress={() => goToProfileSettings(ROUTES.PROFILE.ARCHIVED_MESSAGES)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="View archived messages and undo if needed"
                    >
                      <Text style={styles.viewArchivedButtonText}>
                        View Archived & Undo (24h window)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.collapseButton, dynamicStyles.collapseButton]}
                  onPress={() => setAutoHandledExpanded(false)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Collapse auto-handled section"
                >
                  <Text style={[styles.collapseButtonText, dynamicStyles.collapseButtonText]}>Collapse</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Empty State - No Messages */}
        {digest.highPriority.length === 0 &&
          digest.mediumPriority.length === 0 &&
          digest.autoHandled.faqCount === 0 &&
          digest.autoHandled.archivedCount === 0 && (
            <View style={styles.emptyListContainer}>
              <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.textTertiary} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyListTitle, dynamicStyles.emptyListTitle]}>All Caught Up!</Text>
              <Text style={[styles.emptyListText, dynamicStyles.emptyListText]}>No new messages to handle today.</Text>
            </View>
          )}

        {/* Settings Link */}
        <View style={styles.settingsLink}>
          <TouchableOpacity
            onPress={() => goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Adjust capacity settings"
          >
            <Text style={[styles.settingsLinkText, dynamicStyles.settingsLinkText]}>Adjust Capacity Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Capacity Summary
  capacitySummary: {
    padding: 24,
    borderBottomWidth: 1,
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  capacityValue: {
    fontSize: 14,
  },
  // Priority Sections
  prioritySection: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  // Message Cards
  messageCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreBadge: {
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
    textTransform: 'capitalize',
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  messageContent: {
    fontSize: 15,
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
  },
  timeEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeEstimateText: {
    fontSize: 13,
  },
  // Auto-Handled Card
  autoHandledCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  autoHandledText: {
    fontSize: 14,
    lineHeight: 20,
  },
  autoHandledHint: {
    fontSize: 12,
    marginTop: 8,
  },
  // Story 6.4: Collapsible Auto-Handled Section
  expandButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
    minHeight: 40,
  },
  expandButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  autoHandledExpandedCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  autoHandledSection: {
    marginBottom: 16,
  },
  autoHandledSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  autoHandledSectionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  viewArchivedButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 40,
  },
  viewArchivedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  collapseButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 12,
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Empty List State
  emptyListContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyListTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyListText: {
    fontSize: 16,
    textAlign: 'center',
  },
  // Settings Link
  settingsLink: {
    padding: 24,
    alignItems: 'center',
  },
  settingsLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
