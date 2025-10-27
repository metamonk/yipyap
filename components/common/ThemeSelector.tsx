/**
 * Theme Selector Component
 *
 * @remarks
 * Allows users to choose between Auto (system), Light, or Dark theme modes.
 * Displays current selection and saves preference automatically.
 *
 * @example
 * ```tsx
 * // Add to settings screen
 * <ThemeSelector />
 * ```
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/constants/theme';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    mode: 'auto',
    label: 'Auto',
    icon: 'phone-portrait-outline',
    description: 'Follows system setting',
  },
  {
    mode: 'light',
    label: 'Light',
    icon: 'sunny-outline',
    description: 'Always light mode',
  },
  {
    mode: 'dark',
    label: 'Moon',
    icon: 'moon-outline',
    description: 'Always dark mode',
  },
];

/**
 * Theme selector component with three options
 */
export const ThemeSelector: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Appearance</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Choose how yipyap looks to you
      </Text>

      <View style={styles.optionsContainer}>
        {themeOptions.map((option) => {
          const isSelected = themeMode === option.mode;

          return (
            <TouchableOpacity
              key={option.mode}
              style={[
                styles.option,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
                theme.shadows.sm,
              ]}
              onPress={() => setThemeMode(option.mode)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isSelected ? theme.colors.primary : theme.colors.textPrimary },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textTertiary }]}>
                  {option.description}
                </Text>
              </View>

              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  optionContent: {
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 13,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
