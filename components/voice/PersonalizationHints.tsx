/**
 * Personalization Hints Component (Story 6.2)
 *
 * @remarks
 * Displays personalization suggestions to guide creators in editing AI-generated drafts.
 * Provides 3 specific, actionable prompts tailored to the message category.
 */

import React, { FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PersonalizationSuggestion } from '@/types/ai';

/**
 * Props for the PersonalizationHints component
 */
export interface PersonalizationHintsProps {
  /** Array of personalization suggestions (typically 3) */
  suggestions: PersonalizationSuggestion[];
}

/**
 * Displays personalization suggestions for draft editing
 *
 * @component
 *
 * @remarks
 * - Shows 3 specific personalization prompts
 * - Suggestions are category-specific (business, fan engagement, etc.)
 * - Provides actionable guidance without being prescriptive
 *
 * @example
 * ```tsx
 * <PersonalizationHints
 *   suggestions={[
 *     { text: 'Add specific detail about their message', type: 'context' },
 *     { text: 'Include personal callback to previous conversation', type: 'callback' },
 *     { text: 'End with a question to continue dialogue', type: 'question' }
 *   ]}
 * />
 * ```
 */
export const PersonalizationHints: FC<PersonalizationHintsProps> = ({ suggestions }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💡 Personalization suggestions:</Text>
      {suggestions.map((suggestion, index) => (
        <View key={index} style={styles.suggestionItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.suggestionText}>{suggestion.text}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 6,
  },
  bullet: {
    fontSize: 13,
    color: '#3B82F6',
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
});
