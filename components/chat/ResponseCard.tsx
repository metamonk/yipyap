/**
 * ResponseCard component displays an AI-generated response suggestion
 *
 * @component
 * @remarks
 * Shows individual suggestion text with AI branding, edit button, and swipe hints.
 * Used within ResponseSuggestions carousel for voice-matched response generation.
 *
 * @example
 * ```tsx
 * <ResponseCard
 *   text="That sounds great! When can we chat?"
 *   index={0}
 *   total={3}
 *   onEdit={() => handleEdit(suggestion)}
 * />
 * ```
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Props for the ResponseCard component
 */
export interface ResponseCardProps {
  /** The suggested response text to display */
  text: string;

  /** Index of this suggestion (0-based) */
  index: number;

  /** Total number of suggestions available */
  total: number;

  /** Callback fired when user taps edit button */
  onEdit?: () => void;

  /** Whether to show swipe hints (default: true) */
  showHints?: boolean;
}

/**
 * Displays an individual AI-generated response suggestion card
 *
 * @component
 * @remarks
 * - Shows suggestion text with AI branding icon
 * - Displays suggestion index (e.g., "1 of 3")
 * - Edit button allows manual modification
 * - Swipe hints guide user interaction
 * - Matches existing chat UI styling
 */
export const ResponseCard: FC<ResponseCardProps> = ({
  text,
  index,
  total,
  onEdit,
  showHints = true,
}) => {
  return (
    <View style={styles.card}>
      {/* Header with AI icon and suggestion counter */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={16} color="#6C63FF" />
          <Text style={styles.headerText}>AI Suggestion</Text>
        </View>
        <Text style={styles.counterText}>
          {index + 1} of {total}
        </Text>
      </View>

      {/* Suggestion text */}
      <Text style={styles.suggestionText}>{text}</Text>

      {/* Footer with swipe hints and edit button */}
      <View style={styles.footer}>
        {showHints && (
          <>
            <Text style={styles.hintText}>← Swipe to reject</Text>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} style={styles.editButton} testID="edit-button">
                <Ionicons name="create-outline" size={14} color="#6C63FF" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.hintText}>Accept →</Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5F5FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6C63FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  counterText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  suggestionText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  hintText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  editText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '600',
  },
});
