/**
 * PriorityMessageCard - Individual priority message display component (Story 5.7 - Task 4)
 *
 * @remarks
 * Displays a single priority message with:
 * - Priority badge (Crisis/High-Value Opportunity/Urgent)
 * - Message preview
 * - Category and sentiment indicators
 * - Opportunity score (if applicable)
 * - Relative timestamp
 *
 * @example
 * ```tsx
 * <PriorityMessageCard
 *   item={priorityMessageItem}
 *   onPress={() => navigateToConversation(item.conversationId)}
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { PriorityMessageFeedItem } from '@/types/dashboard';

/**
 * Props for PriorityMessageCard component
 */
interface PriorityMessageCardProps {
  /** Priority message feed item */
  item: PriorityMessageFeedItem;

  /** Callback when card is pressed */
  onPress: () => void;
}

/**
 * PriorityMessageCard Component
 */
export function PriorityMessageCard({ item, onPress }: PriorityMessageCardProps) {
  const { theme } = useTheme();
  const {
    priorityType,
    senderName,
    messageText,
    timestamp,
    category,
    sentiment,
    opportunityScore,
  } = item;

  // Get priority badge config
  const priorityConfig = getPriorityConfig(priorityType, theme);

  // Truncate message text to ~100 characters
  const truncatedText = messageText.length > 100
    ? `${messageText.substring(0, 100)}...`
    : messageText;

  // Format relative timestamp
  const relativeTime = getRelativeTime(timestamp.toDate());

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    senderName: {
      color: theme.colors.textPrimary,
    },
    messagePreview: {
      color: theme.colors.textSecondary,
    },
    opportunityBadge: {
      backgroundColor: theme.colors.success + '20',
    },
    opportunityScore: {
      color: theme.colors.success,
    },
    timestamp: {
      color: theme.colors.textTertiary,
    },
  });

  return (
    <TouchableOpacity
      style={[styles.card, dynamicStyles.card]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${priorityType} message from ${senderName}: ${truncatedText}`}
    >
      {/* Priority Badge */}
      <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.backgroundColor }]}>
        <Ionicons name={priorityConfig.icon} size={16} color={priorityConfig.color} />
        <Text style={[styles.priorityText, { color: priorityConfig.color }]}>
          {priorityConfig.label}
        </Text>
      </View>

      {/* Message Content */}
      <View style={styles.content}>
        {/* Sender Name */}
        <Text style={[styles.senderName, dynamicStyles.senderName]}>{senderName}</Text>

        {/* Message Preview */}
        <Text style={[styles.messagePreview, dynamicStyles.messagePreview]} numberOfLines={2}>
          {truncatedText}
        </Text>

        {/* Metadata Row */}
        <View style={styles.metadataRow}>
          {/* Category Badge */}
          {category && (
            <View style={[styles.metadataBadge, { backgroundColor: getCategoryColor(theme.colors.accent) }]}>
              <Text style={styles.metadataBadgeText}>{getCategoryLabel(category)}</Text>
            </View>
          )}

          {/* Sentiment Indicator */}
          {sentiment && (
            <View style={styles.sentimentIndicator}>
              <Ionicons
                name={getSentimentIcon(sentiment)}
                size={14}
                color={getSentimentColor(sentiment, theme)}
              />
            </View>
          )}

          {/* Opportunity Score */}
          {opportunityScore && opportunityScore >= 70 && (
            <View style={[styles.opportunityBadge, dynamicStyles.opportunityBadge]}>
              <Ionicons name="trending-up" size={12} color={theme.colors.success} />
              <Text style={[styles.opportunityScore, dynamicStyles.opportunityScore]}>{opportunityScore}</Text>
            </View>
          )}

          {/* Timestamp */}
          <Text style={[styles.timestamp, dynamicStyles.timestamp]}>{relativeTime}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Get priority configuration (color, icon, label) - theme-aware
 */
function getPriorityConfig(priorityType: 'crisis' | 'high_value_opportunity' | 'urgent', theme: any) {
  const configs = {
    crisis: {
      label: 'Crisis',
      color: theme.colors.error,
      backgroundColor: theme.colors.error + '20',
      icon: 'alert-circle' as const,
    },
    high_value_opportunity: {
      label: 'High-Value',
      color: theme.colors.success,
      backgroundColor: theme.colors.success + '20',
      icon: 'trending-up' as const,
    },
    urgent: {
      label: 'Urgent',
      color: theme.colors.warning,
      backgroundColor: theme.colors.warning + '20',
      icon: 'warning' as const,
    },
  };

  return configs[priorityType];
}

/**
 * Get category color based on category type - use accent for all (minimal design)
 */
function getCategoryColor(accentColor: string): string {
  return accentColor;
}

/**
 * Get category label for display
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    fan_engagement: 'Fan',
    business_opportunity: 'Business',
    urgent: 'Urgent',
    spam: 'Spam',
    general: 'General',
  };

  return labels[category] || category;
}

/**
 * Get sentiment icon name
 */
function getSentimentIcon(sentiment: string): 'happy-outline' | 'sad-outline' | 'remove-outline' | 'help-outline' {
  const icons = {
    positive: 'happy-outline' as const,
    negative: 'sad-outline' as const,
    neutral: 'remove-outline' as const,
    mixed: 'help-outline' as const,
  };

  return icons[sentiment as keyof typeof icons] || 'remove-outline';
}

/**
 * Get sentiment color - theme-aware
 */
function getSentimentColor(sentiment: string, theme: any): string {
  const colors: Record<string, string> = {
    positive: theme.colors.success,
    negative: theme.colors.error,
    neutral: theme.colors.textSecondary,
    mixed: theme.colors.accent,
  };

  return colors[sentiment] || theme.colors.textSecondary;
}

/**
 * Get relative time string (e.g., "2h ago", "5m ago")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    gap: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    gap: 6,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
  },
  messagePreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metadataBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metadataBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sentimentIndicator: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  opportunityScore: {
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    marginLeft: 'auto',
  },
});
