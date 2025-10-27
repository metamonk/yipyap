/**
 * Reusable Navigation Header Component
 * @component
 * @remarks
 * Provides consistent navigation header across all screens
 * Supports back navigation, title, and action buttons
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface NavigationHeaderProps {
  title: string;
  showBack?: boolean;
  backAction?: () => void;
  rightAction?: {
    label?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
  };
  leftAction?: {
    label?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
  };
  variant?: 'default' | 'modal';
}

/**
 * NavigationHeader component for consistent app navigation
 */
export function NavigationHeader({
  title,
  showBack = false,
  backAction,
  rightAction,
  leftAction,
  variant = 'default',
}: NavigationHeaderProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const handleBack = () => {
    if (backAction) {
      backAction();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to tabs if no navigation history
      router.replace('/(tabs)');
    }
  };

  const isModal = variant === 'modal';

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    safeArea: {
      backgroundColor: theme.colors.surface,
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    actionText: {
      color: theme.colors.accent,
    },
    actionTextDisabled: {
      color: theme.colors.textTertiary,
    },
  });

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]}>
      <View style={[styles.container, dynamicStyles.container, isModal && styles.modalContainer]}>
        <View style={styles.leftSection}>
          {showBack && !leftAction && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.accent} />
            </TouchableOpacity>
          )}
          {leftAction && (
            <TouchableOpacity
              onPress={leftAction.onPress}
              disabled={leftAction.disabled}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {leftAction.icon ? (
                <Ionicons
                  name={leftAction.icon}
                  size={24}
                  color={leftAction.disabled ? theme.colors.textTertiary : theme.colors.accent}
                />
              ) : (
                <Text style={[styles.actionText, dynamicStyles.actionText, leftAction.disabled && dynamicStyles.actionTextDisabled]}>
                  {leftAction.label}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.titleSection}>
          <Text style={[styles.title, dynamicStyles.title]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.rightSection}>
          {rightAction && (
            <TouchableOpacity
              onPress={rightAction.onPress}
              disabled={rightAction.disabled}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {rightAction.icon ? (
                <Ionicons
                  name={rightAction.icon}
                  size={24}
                  color={rightAction.disabled ? theme.colors.textTertiary : theme.colors.accent}
                />
              ) : (
                <Text
                  style={[styles.actionText, dynamicStyles.actionText, rightAction.disabled && dynamicStyles.actionTextDisabled]}
                >
                  {rightAction.label}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  safeArea: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalContainer: {
    borderBottomWidth: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  titleSection: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  actionButton: {
    padding: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionTextDisabled: {},
});
