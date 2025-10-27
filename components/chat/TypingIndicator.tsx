/**
 * TypingIndicator component for displaying active typing users
 *
 * @remarks
 * Shows formatted text like "Alice is typing..." with animated dots.
 * Supports multiple users: "Alice and Bob are typing..."
 * Returns null when no users are typing.
 */

import React, { FC, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/constants/theme';

/**
 * Represents a typing user with display information
 */
export interface TypingUser {
  /** User ID */
  userId: string;

  /** Display name to show in typing indicator */
  displayName: string;
}

/**
 * Props for the TypingIndicator component
 */
export interface TypingIndicatorProps {
  /** Array of users currently typing */
  typingUsers: TypingUser[];
}

/**
 * Displays typing indicator for active typing users in a conversation
 *
 * @component
 *
 * @remarks
 * - Shows formatted text based on number of typing users
 * - Single user: "Alice is typing"
 * - Two users: "Alice and Bob are typing"
 * - Three users: "Alice, Bob, and Charlie are typing"
 * - Four+ users: "Alice, Bob, and 2 others are typing"
 * - Includes animated bouncing dots
 * - Returns null if no users are typing
 *
 * @example
 * ```tsx
 * <TypingIndicator
 *   typingUsers={[{ userId: 'user1', displayName: 'Alice' }]}
 * />
 * // Renders: "Alice is typing..."
 *
 * <TypingIndicator
 *   typingUsers={[
 *     { userId: 'user1', displayName: 'Alice' },
 *     { userId: 'user2', displayName: 'Bob' }
 *   ]}
 * />
 * // Renders: "Alice and Bob are typing..."
 * ```
 */
export const TypingIndicator: FC<TypingIndicatorProps> = ({ typingUsers }) => {
  const { theme } = useTheme();

  // Don't render anything if no users are typing
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  // Format typing text based on number of users
  const typingText = formatTypingText(typingUsers);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.text, { color: theme.colors.textTertiary }]}>{typingText}</Text>
      <AnimatedDots theme={theme} />
    </View>
  );
};

/**
 * Formats typing indicator text based on number of typing users
 *
 * @param typingUsers - Array of typing users with display names
 * @returns Formatted string like "Alice is typing" or "Alice and Bob are typing"
 *
 * @remarks
 * - 1 user: "Alice is typing"
 * - 2 users: "Alice and Bob are typing"
 * - 3 users: "Alice, Bob, and Charlie are typing"
 * - 4+ users: "Alice, Bob, and N others are typing"
 */
function formatTypingText(typingUsers: TypingUser[]): string {
  const count = typingUsers.length;

  if (count === 1) {
    return `${typingUsers[0].displayName} is typing`;
  } else if (count === 2) {
    return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing`;
  } else if (count === 3) {
    return `${typingUsers[0].displayName}, ${typingUsers[1].displayName}, and ${typingUsers[2].displayName} are typing`;
  } else {
    // More than 3 users
    const othersCount = count - 2;
    const otherText = othersCount === 1 ? 'other' : 'others';
    return `${typingUsers[0].displayName}, ${typingUsers[1].displayName}, and ${othersCount} ${otherText} are typing`;
  }
}

/**
 * Animated dots component for typing indicator
 *
 * @component
 *
 * @remarks
 * Renders three dots that bounce up and down with staggered timing
 * for a smooth typing animation effect.
 */
const AnimatedDots: FC<{ theme: Theme }> = ({ theme }) => {
  return (
    <View style={styles.dotsContainer}>
      <Dot delay={0} theme={theme} />
      <Dot delay={150} theme={theme} />
      <Dot delay={300} theme={theme} />
    </View>
  );
};

/**
 * Single animated dot component
 *
 * @component
 *
 * @remarks
 * Uses React Native Animated API for smooth 60fps animation.
 * Bounces up and down continuously with configurable delay.
 */
const Dot: FC<{ delay: number; theme: Theme }> = ({ delay, theme }) => {
  // Use useState to initialize Animated.Value (avoids ref access during render)
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Start animation after delay
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -6,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => {
      clearTimeout(timeout);
      translateY.setValue(0);
    };
  }, [delay, translateY]);

  return (
    <Animated.View style={[styles.dot, { transform: [{ translateY }] }]}>
      <View style={[styles.dotInner, { backgroundColor: theme.colors.textTertiary }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  dot: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  dotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
