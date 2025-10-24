/**
 * OpportunityCard - Displays a business opportunity message (Story 5.6)
 *
 * @remarks
 * Shows opportunity score, type badge, analysis, and preview of the message.
 * Tapping navigates to the conversation for detailed view.
 * Story 5.6 - Task 13.4: Includes slide-in animation for new cards
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Message } from '@/types/models';
import type { OpportunityType } from '@/services/aiClientService';

/**
 * Props for OpportunityCard component
 */
interface OpportunityCardProps {
  /** Message with opportunity scoring data */
  message: Message;

  /** Optional press handler (default: navigate to conversation) */
  onPress?: () => void;

  /** Whether to animate the card entrance (default: false) */
  animated?: boolean;
}

/**
 * Get color for opportunity type badge
 */
function getTypeColor(type: OpportunityType): string {
  switch (type) {
    case 'sponsorship':
      return '#8B5CF6'; // Purple
    case 'collaboration':
      return '#3B82F6'; // Blue
    case 'partnership':
      return '#10B981'; // Green
    case 'sale':
      return '#F59E0B'; // Orange
    default:
      return '#6B7280'; // Gray
  }
}

/**
 * Get background color for opportunity score
 */
function getScoreBackgroundColor(score: number): string {
  if (score >= 90) return '#DCFCE7'; // Light green
  if (score >= 70) return '#FEF3C7'; // Light yellow
  return '#FEE2E2'; // Light red
}

/**
 * Get text color for opportunity score
 */
function getScoreTextColor(score: number): string {
  if (score >= 90) return '#15803D'; // Dark green
  if (score >= 70) return '#A16207'; // Dark yellow
  return '#B91C1C'; // Dark red
}

/**
 * OpportunityCard Component
 *
 * @example
 * ```tsx
 * <OpportunityCard message={message} animated={true} />
 * ```
 */
export function OpportunityCard({ message, onPress, animated = false }: OpportunityCardProps) {
  const router = useRouter();

  // Animation values (Story 5.6 - Task 13.4)
  const translateX = useSharedValue(animated ? 300 : 0);
  const opacity = useSharedValue(animated ? 0 : 1);

  const score = message.metadata.opportunityScore || 0;
  const type = message.metadata.opportunityType || 'sale';
  const analysis = message.metadata.opportunityAnalysis || 'Business opportunity detected';
  const indicators = message.metadata.opportunityIndicators || [];

  /**
   * Trigger slide-in animation on mount (Story 5.6 - Task 13.4)
   */
  useEffect(() => {
    if (animated) {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      opacity.value = withTiming(1, {
        duration: 300,
      });
    }
  }, [animated, translateX, opacity]);

  /**
   * Animated style for slide-in effect
   */
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to conversation
      router.push(`/conversations/${message.conversationId}`);
    }
  };

  // Format timestamp
  const timestamp = message.timestamp.toDate();
  const timeStr = timestamp.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Opportunity: ${analysis}`}
        accessibilityHint="Tap to view full conversation"
      >
      {/* Header: Score + Type Badge */}
      <View style={styles.header}>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreBackgroundColor(score) }]}>
          <Text style={[styles.scoreText, { color: getScoreTextColor(score) }]}>
            {score}
          </Text>
        </View>

        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(type) }]}>
          <Text style={styles.typeText}>{type.toUpperCase()}</Text>
        </View>

        <Text style={styles.timestamp}>{timeStr}</Text>
      </View>

      {/* Analysis Summary */}
      <Text style={styles.analysis} numberOfLines={2}>
        {analysis}
      </Text>

      {/* Message Preview */}
      <Text style={styles.messagePreview} numberOfLines={3}>
        {message.text}
      </Text>

      {/* Indicators */}
      {indicators.length > 0 && (
        <View style={styles.indicatorsContainer}>
          {indicators.slice(0, 3).map((indicator, index) => (
            <View key={index} style={styles.indicator}>
              <Text style={styles.indicatorText}>{indicator}</Text>
            </View>
          ))}
          {indicators.length > 3 && (
            <Text style={styles.moreIndicators}>+{indicators.length - 3} more</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 'auto',
  },
  analysis: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 20,
  },
  messagePreview: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  indicator: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  indicatorText: {
    fontSize: 11,
    color: '#6B7280',
  },
  moreIndicators: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
