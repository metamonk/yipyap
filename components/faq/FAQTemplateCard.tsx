/**
 * FAQ Template Card Component
 *
 * @remarks
 * Displays a single FAQ template in the FAQ Library with:
 * - Question and answer preview
 * - Category badge
 * - Usage statistics
 * - Active/inactive toggle
 * - Edit functionality
 *
 * @module components/faq/FAQTemplateCard
 */

import React, { FC, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { FAQTemplate } from '@/types/faq';
import { toggleFAQActive } from '@/services/faqService';

/**
 * Props for the FAQTemplateCard component
 */
export interface FAQTemplateCardProps {
  /** The FAQ template data to display */
  template: FAQTemplate;

  /** Callback fired when the card is pressed for editing */
  onPress: (template: FAQTemplate) => void;

  /** Callback fired when the template is updated (e.g., toggled active/inactive) */
  onUpdate?: (template: FAQTemplate) => void;
}

/**
 * Displays a single FAQ template card with edit and toggle functionality
 *
 * @component
 *
 * @remarks
 * - Shows question (truncated to 2 lines)
 * - Shows answer preview (truncated to 1 line)
 * - Displays category badge
 * - Shows usage count
 * - Active/inactive toggle switch
 * - Tappable to open editor
 *
 * @example
 * ```tsx
 * <FAQTemplateCard
 *   template={faqTemplate}
 *   onPress={(template) => openEditor(template)}
 *   onUpdate={(updated) => refreshList()}
 * />
 * ```
 */
export const FAQTemplateCard: FC<FAQTemplateCardProps> = ({
  template,
  onPress,
  onUpdate,
}) => {
  const { theme } = useTheme();
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isActive, setIsActive] = useState(template.isActive);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    question: {
      color: theme.colors.textPrimary,
    },
    answer: {
      color: theme.colors.textSecondary,
    },
    statsIcon: {
      color: theme.colors.textSecondary,
    },
    statsText: {
      color: theme.colors.textSecondary,
    },
    chevronIcon: {
      color: theme.colors.disabled || '#C7C7CC',
    },
    inactiveOverlayIcon: {
      color: theme.colors.textSecondary,
    },
    inactiveText: {
      color: theme.colors.textSecondary,
    },
  });

  /**
   * Handles toggling the active status of the FAQ template
   */
  const handleToggleActive = async () => {
    const newActiveState = !isActive;

    setIsTogglingActive(true);
    try {
      const updated = await toggleFAQActive(template.id, newActiveState);
      setIsActive(updated.isActive);

      if (onUpdate) {
        onUpdate(updated);
      }
    } catch (error) {
      console.error('Error toggling FAQ active status:', error);
      Alert.alert(
        'Error',
        'Failed to update FAQ status. Please try again.'
      );
    } finally {
      setIsTogglingActive(false);
    }
  };

  /**
   * Gets the category badge color based on category name
   */
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      pricing: '#34C759',
      availability: '#FF9500',
      shipping: '#5856D6',
      refunds: '#FF3B30',
      technical: '#007AFF',
      general: '#8E8E93',
      other: '#AF52DE',
    };

    return colors[category.toLowerCase()] || colors.general;
  };

  /**
   * Truncates text to specified length with ellipsis
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <TouchableOpacity
      style={[styles.container, dynamicStyles.container, !isActive && styles.containerInactive]}
      onPress={() => onPress(template)}
      activeOpacity={0.7}
    >
      {/* Header: Category Badge and Toggle */}
      <View style={styles.header}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: getCategoryColor(template.category) },
          ]}
        >
          <Text style={styles.categoryText}>
            {template.category.toUpperCase()}
          </Text>
        </View>

        <View style={styles.toggleContainer}>
          {isTogglingActive ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Switch
              value={isActive}
              onValueChange={handleToggleActive}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
            />
          )}
        </View>
      </View>

      {/* Question */}
      <Text style={[styles.question, dynamicStyles.question]} numberOfLines={2} ellipsizeMode="tail">
        {template.question}
      </Text>

      {/* Answer Preview */}
      <Text style={[styles.answer, dynamicStyles.answer]} numberOfLines={1} ellipsizeMode="tail">
        {template.answer}
      </Text>

      {/* Footer: Stats and Edit Icon */}
      <View style={styles.footer}>
        <View style={styles.stats}>
          <Ionicons name="repeat-outline" size={16} color={dynamicStyles.statsIcon.color} />
          <Text style={[styles.statsText, dynamicStyles.statsText]}>
            Used {template.useCount} {template.useCount === 1 ? 'time' : 'times'}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color={dynamicStyles.chevronIcon.color} />
      </View>

      {/* Inactive Overlay */}
      {!isActive && (
        <View style={styles.inactiveOverlay}>
          <Ionicons name="pause-circle-outline" size={24} color={dynamicStyles.inactiveOverlayIcon.color} />
          <Text style={[styles.inactiveText, dynamicStyles.inactiveText]}>Inactive</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  containerInactive: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  question: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  answer: {
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    marginLeft: 6,
  },
  inactiveOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -30 }],
    alignItems: 'center',
  },
  inactiveText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
});
