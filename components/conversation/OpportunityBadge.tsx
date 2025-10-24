/**
 * OpportunityBadge component - Story 5.6
 *
 * @remarks
 * Displays an opportunity score badge with color-coding based on score level.
 * Shows only for high-value opportunities (score >= 70).
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Props for OpportunityBadge component
 */
export interface OpportunityBadgeProps {
  /** Opportunity score (0-100) */
  score: number;

  /** Size variant (default: 'small') */
  size?: 'small' | 'medium' | 'large';

  /** Show icon (default: true) */
  showIcon?: boolean;
}

/**
 * Get badge color based on opportunity score
 * @param score - Opportunity score (0-100)
 * @returns Object with background and text colors
 */
function getScoreColors(score: number): { backgroundColor: string; textColor: string; iconColor: string } {
  if (score >= 90) {
    // Exceptional (90-100)
    return {
      backgroundColor: '#DCFCE7', // Light green
      textColor: '#166534', // Dark green
      iconColor: '#16A34A', // Green
    };
  } else if (score >= 80) {
    // High value (80-89)
    return {
      backgroundColor: '#FEF3C7', // Light yellow
      textColor: '#92400E', // Dark yellow
      iconColor: '#F59E0B', // Orange
    };
  } else {
    // Good (70-79)
    return {
      backgroundColor: '#DBEAFE', // Light blue
      textColor: '#1E40AF', // Dark blue
      iconColor: '#3B82F6', // Blue
    };
  }
}

/**
 * Get badge size styles
 * @param size - Size variant
 * @returns Object with size-specific styles
 */
function getSizeStyles(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'large':
      return {
        container: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
        text: { fontSize: 14, fontWeight: '700' as const },
        icon: 18,
      };
    case 'medium':
      return {
        container: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
        text: { fontSize: 12, fontWeight: '600' as const },
        icon: 14,
      };
    case 'small':
    default:
      return {
        container: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
        text: { fontSize: 10, fontWeight: '600' as const },
        icon: 12,
      };
  }
}

/**
 * OpportunityBadge Component
 *
 * @example
 * ```tsx
 * <OpportunityBadge score={95} size="small" />
 * <OpportunityBadge score={75} size="medium" showIcon={false} />
 * ```
 */
export const OpportunityBadge: FC<OpportunityBadgeProps> = ({
  score,
  size = 'small',
  showIcon = true,
}) => {
  const colors = getScoreColors(score);
  const sizeStyles = getSizeStyles(size);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundColor },
        sizeStyles.container,
      ]}
      accessibilityLabel={`Business opportunity score: ${score} out of 100`}
      accessibilityRole="text"
    >
      {showIcon && (
        <Ionicons
          name="briefcase"
          size={sizeStyles.icon}
          color={colors.iconColor}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.scoreText,
          { color: colors.textColor },
          sizeStyles.text,
        ]}
      >
        {score}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 3,
  },
  scoreText: {
    letterSpacing: 0.3,
  },
});
