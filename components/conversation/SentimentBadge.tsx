/**
 * SentimentBadge Component
 * Displays a compact sentiment indicator with emoji/icon and color coding
 * Story 5.3 - Sentiment Analysis & Crisis Detection
 */

import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';

/**
 * Props for SentimentBadge component
 */
export interface SentimentBadgeProps {
  /** Sentiment classification */
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';

  /** Sentiment score (-1 to 1) */
  sentimentScore: number;

  /** Display size */
  size?: 'small' | 'medium' | 'large';
}

/**
 * SentimentBadge Component
 *
 * Displays a colored emoji or icon based on sentiment classification.
 * Includes accessibility support for screen readers and color-blind users.
 *
 * @component
 * @example
 * ```tsx
 * <SentimentBadge
 *   sentiment="positive"
 *   sentimentScore={0.85}
 *   size="small"
 * />
 * ```
 */
export const SentimentBadge: React.FC<SentimentBadgeProps> = ({
  sentiment,
  sentimentScore,
  size = 'small',
}) => {
  /**
   * Get emoji and symbol for sentiment
   * Uses both emoji and shape for color-blind accessibility
   */
  const getSentimentDisplay = (): { emoji: string; symbol: string; color: string } => {
    switch (sentiment) {
      case 'positive':
        return {
          emoji: '😊',
          symbol: '✓', // Checkmark for color-blind users
          color: '#22C55E', // Green
        };
      case 'negative':
        return {
          emoji: '😟',
          symbol: '⚠', // Warning triangle for color-blind users
          color: '#EF4444', // Red
        };
      case 'neutral':
        return {
          emoji: '😐',
          symbol: '–', // Dash for color-blind users
          color: '#6B7280', // Gray
        };
      case 'mixed':
        return {
          emoji: '🤔',
          symbol: '?', // Question mark for color-blind users
          color: '#F59E0B', // Yellow/Amber
        };
      default:
        return {
          emoji: '😐',
          symbol: '–',
          color: '#6B7280',
        };
    }
  };

  const display = getSentimentDisplay();

  /**
   * Get size dimensions
   */
  const getSizeStyles = () => {
    switch (size) {
      case 'large':
        return { fontSize: 24, padding: 8, minWidth: 40 };
      case 'medium':
        return { fontSize: 18, padding: 6, minWidth: 32 };
      case 'small':
      default:
        return { fontSize: 14, padding: 4, minWidth: 24 };
    }
  };

  const sizeStyles = getSizeStyles();

  /**
   * Format accessibility label
   */
  const getAccessibilityLabel = (): string => {
    const sentimentLabel = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
    const scoreLabel = Math.abs(sentimentScore).toFixed(2);
    const direction = sentimentScore >= 0 ? 'positive' : 'negative';

    return `${sentimentLabel} sentiment. Score: ${scoreLabel} ${direction}.`;
  };

  /**
   * Get accessibility hint
   */
  const getAccessibilityHint = (): string => {
    return `Sentiment score ranges from -1 (very negative) to +1 (very positive). Current score: ${sentimentScore.toFixed(2)}.`;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${display.color}20`, // 20% opacity background
          borderColor: display.color,
          minWidth: sizeStyles.minWidth,
          padding: sizeStyles.padding,
        },
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={getAccessibilityLabel()}
      accessibilityHint={getAccessibilityHint()}
    >
      {/* Emoji for visual users */}
      <Text
        style={[styles.emoji, { fontSize: sizeStyles.fontSize }]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      >
        {display.emoji}
      </Text>

      {/* Symbol for color-blind accessibility (overlaid) */}
      <Text
        style={[
          styles.symbol,
          {
            fontSize: sizeStyles.fontSize * 0.6,
            color: display.color,
          },
        ]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      >
        {display.symbol}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    position: 'relative',
  },
  emoji: {
    textAlign: 'center',
  },
  symbol: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    fontWeight: 'bold',
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
});
