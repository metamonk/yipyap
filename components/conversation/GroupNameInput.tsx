/**
 * GroupNameInput Component
 *
 * @remarks
 * A conditional input field for group name that appears when 2+ recipients are selected.
 * Features smooth animations and character counting.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GroupNameInputProps {
  value: string;
  onChange: (value: string) => void;
  isVisible: boolean;
  maxLength?: number;
  placeholder?: string;
  testID?: string;
}

/**
 * GroupNameInput provides an animated input field for group conversation names
 *
 * @component
 * @example
 * ```tsx
 * <GroupNameInput
 *   value={groupName}
 *   onChange={setGroupName}
 *   isVisible={recipients.length >= 2}
 *   maxLength={50}
 * />
 * ```
 */
export const GroupNameInput: React.FC<GroupNameInputProps> = ({
  value,
  onChange,
  isVisible,
  maxLength = 50,
  placeholder = 'Group name (required)',
  testID,
}) => {
  const [animatedHeight] = useState(() => new Animated.Value(0));
  const [animatedOpacity] = useState(() => new Animated.Value(0));
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isVisible) {
      // Animate in - height and opacity must use same driver setting
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: 88, // Height of the container
          duration: 250,
          useNativeDriver: false, // Layout properties cannot use native driver
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 200,
          delay: 50,
          useNativeDriver: false, // Must match height animation driver
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false, // Must match height animation driver
        }),
        Animated.timing(animatedHeight, {
          toValue: 0,
          duration: 200,
          delay: 50,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isVisible, animatedHeight, animatedOpacity]);

  const showCharCount = value.length > maxLength * 0.8; // Show when 80% full
  const isNearLimit = value.length > maxLength * 0.9; // Warn when 90% full
  const remainingChars = maxLength - value.length;

  // Don't render if not visible initially (avoid unnecessary rendering)
  // Note: We can't check Animated.Value during render, so we rely on isVisible
  if (!isVisible) {
    // Component will animate out before unmounting
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: animatedHeight,
          opacity: animatedOpacity,
        },
      ]}
      testID={testID}
    >
      <View style={styles.labelRow}>
        <Text style={styles.label}>GROUP NAME</Text>
        {showCharCount && (
          <Text
            style={[
              styles.charCount,
              isNearLimit && styles.charCountWarning,
              remainingChars === 0 && styles.charCountError,
            ]}
          >
            {remainingChars}
          </Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="people" size={24} color="#8E8E93" style={styles.icon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#C7C7CC"
          maxLength={maxLength}
          autoCapitalize="words"
          autoCorrect={true}
          returnKeyType="done"
          accessibilityLabel="Group name"
          accessibilityHint={`Required group name, maximum ${maxLength} characters`}
          testID={`${testID}-input`}
        />
      </View>

      <Text style={styles.helperText}>Give your group a memorable name</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  charCountWarning: {
    color: '#FF9500',
  },
  charCountError: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    ...Platform.select({
      ios: {
        fontWeight: '400',
      },
      android: {
        fontWeight: 'normal',
      },
    }),
  },
  helperText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 6,
  },
});
