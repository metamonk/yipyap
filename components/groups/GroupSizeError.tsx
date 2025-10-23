import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// ValidationSeverity type is used in props but imported via inline type definition

/**
 * Props for the GroupSizeError component
 * @interface GroupSizeErrorProps
 */
export interface GroupSizeErrorProps {
  /** Error or warning message to display */
  message: string;

  /** Message severity (error or warning) */
  severity: 'error' | 'warning';

  /** Optional suggestion text (e.g., "Remove members to continue") */
  suggestion?: string;

  /** Whether the message can be dismissed (default: true) */
  dismissible?: boolean;

  /** Callback when message is dismissed */
  onDismiss?: () => void;

  /** Custom testID for testing (default: 'group-size-error') */
  testID?: string;
}

/**
 * Displays error or warning messages for group size validation
 *
 * @component
 * @remarks
 * Shows user-friendly error/warning messages with:
 * - Color-coded styling (red for errors, orange for warnings)
 * - Optional suggestion text for actionable guidance
 * - Dismissible with fade-out animation
 * - Accessibility announcements for screen readers
 * - Icon indicators for visual clarity
 *
 * Automatically announces messages to screen readers when displayed.
 * Optimized with React.memo to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * <GroupSizeError
 *   message="Groups are limited to 10 members"
 *   severity="error"
 *   suggestion="Remove some members to continue"
 *   onDismiss={() => console.log('dismissed')}
 * />
 * ```
 */
export const GroupSizeError = memo<GroupSizeErrorProps>(
  ({
    message,
    severity,
    suggestion,
    dismissible = true,
    onDismiss,
    testID = 'group-size-error',
  }) => {
    const [dismissed, setDismissed] = useState(false);

    // Announce to screen readers when message is displayed
    useEffect(() => {
      const announcement = suggestion ? `${message}. ${suggestion}` : message;
      AccessibilityInfo.announceForAccessibility(announcement);
    }, [message, suggestion]);

    // Handle dismiss
    const handleDismiss = () => {
      if (!dismissible || !onDismiss) return;
      setDismissed(true);
      onDismiss();
    };

    // Don't render if dismissed
    if (dismissed) {
      return null;
    }

    // Determine styling based on severity
    const colors = getColorsBySeverity(severity);
    const icon = getIconBySeverity(severity);

    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
        testID={testID}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {/* Icon */}
        <Ionicons
          name={icon}
          size={20}
          color={colors.icon}
          style={styles.icon}
          testID={`${testID}-icon`}
        />

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[styles.message, { color: colors.text }]}
            testID={`${testID}-message`}
            accessibilityRole="text"
          >
            {message}
          </Text>
          {suggestion && (
            <Text
              style={[styles.suggestion, { color: colors.suggestion }]}
              testID={`${testID}-suggestion`}
              accessibilityRole="text"
            >
              {suggestion}
            </Text>
          )}
        </View>

        {/* Dismiss Button */}
        {dismissible && onDismiss && (
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissButton}
            testID={`${testID}-dismiss`}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            accessibilityHint="Removes this message from view"
          >
            <Ionicons name="close" size={20} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

GroupSizeError.displayName = 'GroupSizeError';

/**
 * Returns color scheme based on severity
 * @param severity - Message severity level
 * @returns Object with color values for different elements
 */
function getColorsBySeverity(severity: 'error' | 'warning'): {
  background: string;
  text: string;
  icon: string;
  suggestion: string;
} {
  switch (severity) {
    case 'error':
      return {
        background: '#FFEBEE', // Light red
        text: '#C62828', // Dark red
        icon: '#F44336', // Red
        suggestion: '#D32F2F', // Medium red
      };
    case 'warning':
      return {
        background: '#FFF3E0', // Light orange
        text: '#E65100', // Dark orange
        icon: '#FF9800', // Orange
        suggestion: '#F57C00', // Medium orange
      };
  }
}

/**
 * Returns appropriate icon name based on severity
 * @param severity - Message severity level
 * @returns Ionicons icon name
 */
function getIconBySeverity(severity: 'error' | 'warning'): keyof typeof Ionicons.glyphMap {
  switch (severity) {
    case 'error':
      return 'alert-circle';
    case 'warning':
      return 'warning';
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  suggestion: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});
