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
  const priorityConfig = getPriorityConfig(priorityType);

  // Truncate message text to ~100 characters
  const truncatedText = messageText.length > 100
    ? `${messageText.substring(0, 100)}...`
    : messageText;

  // Format relative timestamp
  const relativeTime = getRelativeTime(timestamp.toDate());

  return (
    <TouchableOpacity
      style={styles.card}
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
        <Text style={styles.senderName}>{senderName}</Text>

        {/* Message Preview */}
        <Text style={styles.messagePreview} numberOfLines={2}>
          {truncatedText}
        </Text>

        {/* Metadata Row */}
        <View style={styles.metadataRow}>
          {/* Category Badge */}
          {category && (
            <View style={[styles.metadataBadge, { backgroundColor: getCategoryColor(category) }]}>
              <Text style={styles.metadataBadgeText}>{getCategoryLabel(category)}</Text>
            </View>
          )}

          {/* Sentiment Indicator */}
          {sentiment && (
            <View style={styles.sentimentIndicator}>
              <Ionicons
                name={getSentimentIcon(sentiment)}
                size={14}
                color={getSentimentColor(sentiment)}
              />
            </View>
          )}

          {/* Opportunity Score */}
          {opportunityScore && opportunityScore >= 70 && (
            <View style={styles.opportunityBadge}>
              <Ionicons name="trending-up" size={12} color="#38A169" />
              <Text style={styles.opportunityScore}>{opportunityScore}</Text>
            </View>
          )}

          {/* Timestamp */}
          <Text style={styles.timestamp}>{relativeTime}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Get priority configuration (color, icon, label)
 */
function getPriorityConfig(priorityType: 'crisis' | 'high_value_opportunity' | 'urgent') {
  const configs = {
    crisis: {
      label: 'Crisis',
      color: '#E53E3E',
      backgroundColor: '#FEF2F2',
      icon: 'alert-circle' as const,
    },
    high_value_opportunity: {
      label: 'High-Value',
      color: '#38A169',
      backgroundColor: '#F0FDF4',
      icon: 'trending-up' as const,
    },
    urgent: {
      label: 'Urgent',
      color: '#DD6B20',
      backgroundColor: '#FFFAF0',
      icon: 'warning' as const,
    },
  };

  return configs[priorityType];
}

/**
 * Get category color based on category type
 */
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    fan_engagement: '#3182CE',
    business_opportunity: '#38A169',
    urgent: '#DD6B20',
    spam: '#6B7280',
    general: '#9CA3AF',
  };

  return colors[category] || '#9CA3AF';
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
 * Get sentiment color
 */
function getSentimentColor(sentiment: string): string {
  const colors: Record<string, string> = {
    positive: '#48BB78',
    negative: '#F56565',
    neutral: '#A0AEC0',
    mixed: '#9F7AEA',
  };

  return colors[sentiment] || '#A0AEC0';
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    color: '#1F2937',
  },
  messagePreview: {
    fontSize: 14,
    color: '#4B5563',
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
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  opportunityScore: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38A169',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 'auto',
  },
});
