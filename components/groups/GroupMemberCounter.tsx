import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GROUP_SIZE_LIMIT, GROUP_SIZE_LIMIT_ARIA_LABEL } from '@/constants/groupLimits';
import type { ValidationSeverity } from '@/types/models';

/**
 * Props for the GroupMemberCounter component
 * @interface GroupMemberCounterProps
 */
export interface GroupMemberCounterProps {
  /** Current number of selected members (including current user) */
  count: number;

  /** Validation severity for color coding (success/warning/error) */
  severity: ValidationSeverity;

  /** Whether to show the progress bar (default: true) */
  showProgressBar?: boolean;

  /** Custom testID for testing (default: 'group-member-counter') */
  testID?: string;
}

/**
 * Displays real-time member count with visual feedback for group creation
 *
 * @component
 * @remarks
 * Provides visual feedback about group size with color-coded display:
 * - Green (0-7 members): Normal state
 * - Orange (8-9 members): Warning - approaching limit
 * - Red (10 members): Error - limit reached
 *
 * Includes accessibility support with ARIA labels and screen reader announcements.
 * Optimized with React.memo to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * <GroupMemberCounter
 *   count={8}
 *   severity="warning"
 *   showProgressBar={true}
 * />
 * ```
 */
export const GroupMemberCounter = memo<GroupMemberCounterProps>(
  ({ count, severity, showProgressBar = true, testID = 'group-member-counter' }) => {
    // Calculate progress percentage (0-100%)
    const progressPercentage = Math.min((count / GROUP_SIZE_LIMIT) * 100, 100);

    // Determine colors based on severity
    const colors = getColorsBySeverity(severity);

    // Accessibility label
    const accessibilityLabel =
      count >= GROUP_SIZE_LIMIT
        ? GROUP_SIZE_LIMIT_ARIA_LABEL
        : `${count} of ${GROUP_SIZE_LIMIT} members selected. ${GROUP_SIZE_LIMIT - count} slots remaining.`;

    return (
      <View style={styles.container} testID={testID} accessibilityLabel={accessibilityLabel}>
        {/* Counter Text */}
        <Text
          style={[styles.counterText, { color: colors.text }]}
          testID={`${testID}-text`}
          accessibilityRole="text"
        >
          {count} of {GROUP_SIZE_LIMIT} members
        </Text>

        {/* Progress Bar */}
        {showProgressBar && (
          <View
            style={styles.progressBarContainer}
            testID={`${testID}-progress-container`}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: GROUP_SIZE_LIMIT,
              now: count,
            }}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercentage}%`,
                  backgroundColor: colors.progress,
                },
              ]}
              testID={`${testID}-progress-fill`}
            />
          </View>
        )}
      </View>
    );
  }
);

GroupMemberCounter.displayName = 'GroupMemberCounter';

/**
 * Returns color scheme based on validation severity
 * @param severity - Validation severity level
 * @returns Object with text and progress bar colors
 */
function getColorsBySeverity(severity: ValidationSeverity): {
  text: string;
  progress: string;
} {
  switch (severity) {
    case 'error':
      return {
        text: '#F44336', // Red
        progress: '#F44336', // Red
      };
    case 'warning':
      return {
        text: '#FF9800', // Orange
        progress: '#FF9800', // Orange
      };
    case 'success':
    default:
      return {
        text: '#4CAF50', // Green
        progress: '#4CAF50', // Green
      };
  }
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    // Note: React Native doesn't support CSS transitions
    // Use Animated API if smooth transitions are needed
  },
});
