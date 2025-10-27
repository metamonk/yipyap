/**
 * Premium Robinhood-style Button component
 *
 * @remarks
 * Implements Robinhood's signature button aesthetic with:
 * - Green primary variant (signature Robinhood color)
 * - Subtle spring press animation
 * - Multiple sizes (sm, md, lg)
 * - Multiple variants (primary, secondary, ghost, danger)
 * - Theme-aware for light/dark modes
 * - High contrast and accessibility
 *
 * @example
 * ```tsx
 * <Button
 *   variant="primary"
 *   size="md"
 *   onPress={handleSubmit}
 * >
 *   Continue
 * </Button>
 * ```
 */

import React, { FC, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Button size options
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Button component
 */
export interface ButtonProps {
  /** Button text content */
  children: string;

  /** Visual variant of the button */
  variant?: ButtonVariant;

  /** Size of the button */
  size?: ButtonSize;

  /** Callback fired when button is pressed */
  onPress?: () => void;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Whether to show loading spinner */
  loading?: boolean;

  /** Full width button */
  fullWidth?: boolean;

  /** Custom style overrides */
  style?: ViewStyle;

  /** Custom text style overrides */
  textStyle?: TextStyle;

  /** Accessibility label */
  accessibilityLabel?: string;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Premium Robinhood-style Button component
 *
 * @component
 *
 * @remarks
 * Features:
 * - Spring animation on press (98% scale)
 * - Loading state with spinner
 * - Disabled state with reduced opacity
 * - Multiple variants for different contexts
 * - Theme-aware colors
 * - Bold text (Robinhood signature)
 */
export const Button: FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}) => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Spring animation handlers
  const handlePressIn = () => {
    if (disabled || loading) return;

    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading || !onPress) return;
    onPress();
  };

  // Size configurations
  const sizeConfig = {
    sm: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      fontSize: theme.typography.fontSize.sm,
      minHeight: 36,
    },
    md: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      fontSize: theme.typography.fontSize.base,
      minHeight: 48,
    },
    lg: {
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.xl,
      fontSize: theme.typography.fontSize.md,
      minHeight: 56,
    },
  };

  // Variant configurations
  const variantConfig = {
    primary: {
      backgroundColor: theme.colors.accent, // Robinhood green
      textColor: variant === 'primary' ? '#FFFFFF' : theme.colors.textPrimary,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      textColor: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
      textColor: theme.colors.accent,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    danger: {
      backgroundColor: theme.colors.error,
      textColor: '#FFFFFF',
      borderWidth: 0,
      borderColor: 'transparent',
    },
  };

  const currentSize = sizeConfig[size];
  const currentVariant = variantConfig[variant];

  // Dynamic styles
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: currentVariant.backgroundColor,
      paddingVertical: currentSize.paddingVertical,
      paddingHorizontal: currentSize.paddingHorizontal,
      minHeight: currentSize.minHeight,
      borderRadius: theme.borderRadius.lg,
      borderWidth: currentVariant.borderWidth,
      borderColor: currentVariant.borderColor,
      opacity: disabled ? 0.5 : 1,
      width: fullWidth ? '100%' : undefined,
      // Shadow only for primary and danger (elevated)
      ...(variant === 'primary' || variant === 'danger' ? theme.shadows.sm : {}),
    },
    text: {
      color: currentVariant.textColor,
      fontSize: currentSize.fontSize,
      fontWeight: theme.typography.fontWeight.bold, // Robinhood uses bold buttons
      textAlign: 'center',
      letterSpacing: theme.typography.letterSpacing.normal,
    },
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        width: fullWidth ? '100%' : undefined,
      }}
    >
      <TouchableOpacity
        style={[dynamicStyles.container, style]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1} // Let animation handle feedback
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || children}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={currentVariant.textColor}
          />
        ) : (
          <Text style={[dynamicStyles.text, textStyle]}>{children}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

Button.displayName = 'Button';
