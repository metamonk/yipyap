/**
 * Premium Robinhood-style Input component
 *
 * @remarks
 * Implements Robinhood's signature minimal input aesthetic with:
 * - Bottom-border style (Robinhood signature)
 * - Smooth focus animations
 * - Theme-aware colors
 * - Clean, minimal design
 * - Label and error support
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email"
 *   value={email}
 *   onChangeText={setEmail}
 *   keyboardType="email-address"
 * />
 * ```
 */

import React, { FC, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for the Input component
 */
export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Input label (optional) */
  label?: string;

  /** Error message to display */
  error?: string;

  /** Whether the input is disabled */
  disabled?: boolean;

  /** Custom container style */
  containerStyle?: ViewStyle;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Premium Robinhood-style Input component
 *
 * @component
 *
 * @remarks
 * Features:
 * - Bottom-border style (minimal Robinhood aesthetic)
 * - Focus animation (border color + width)
 * - Label animation (moves up on focus)
 * - Error state with red border
 * - Theme-aware colors
 * - Clean, spacious design
 */
export const Input: FC<InputProps> = ({
  label,
  error,
  disabled = false,
  containerStyle,
  testID,
  value,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const borderWidthAnim = useRef(new Animated.Value(1)).current;
  const labelPositionAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);

    // Animate border width
    Animated.spring(borderWidthAnim, {
      toValue: 2,
      useNativeDriver: false,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
    }).start();

    // Animate label up if value is empty
    if (!value && label) {
      Animated.timing(labelPositionAnim, {
        toValue: 1,
        duration: theme.animation.duration.fast,
        useNativeDriver: false,
      }).start();
    }

    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);

    // Animate border width back
    Animated.spring(borderWidthAnim, {
      toValue: 1,
      useNativeDriver: false,
      damping: theme.animation.spring.damping,
      stiffness: theme.animation.spring.stiffness,
    }).start();

    // Animate label down if value is empty
    if (!value && label) {
      Animated.timing(labelPositionAnim, {
        toValue: 0,
        duration: theme.animation.duration.fast,
        useNativeDriver: false,
      }).start();
    }

    onBlur?.(e);
  };

  // Determine border color
  const borderColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.accent // Robinhood green on focus
    : theme.colors.border;

  // Dynamic styles
  const dynamicStyles = StyleSheet.create({
    container: {
      marginBottom: theme.spacing.base,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: error ? theme.colors.error : theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: 0, // No horizontal padding for bottom-border style
      backgroundColor: 'transparent',
    },
    border: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: borderWidthAnim,
      backgroundColor: borderColor,
    },
    error: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });

  return (
    <View style={[dynamicStyles.container, containerStyle]} testID={testID}>
      {label && <Text style={dynamicStyles.label}>{label}</Text>}

      <View style={dynamicStyles.inputContainer}>
        <TextInput
          style={dynamicStyles.input}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          placeholderTextColor={theme.colors.textTertiary}
          {...textInputProps}
        />

        {/* Animated bottom border */}
        <Animated.View style={dynamicStyles.border} />
      </View>

      {error && <Text style={dynamicStyles.error}>{error}</Text>}
    </View>
  );
};

Input.displayName = 'Input';
