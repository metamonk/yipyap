/**
 * SuggestedFAQButton component for displaying FAQ suggestions
 *
 * @remarks
 * Displays a button to send a suggested FAQ response when message has
 * medium-confidence FAQ match (0.70-0.84). Creator can review and approve.
 *
 * @module components/chat/SuggestedFAQButton
 */

import React, { FC, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { Message } from '@/types/models';

/**
 * Props for the SuggestedFAQButton component
 */
export interface SuggestedFAQButtonProps {
  /** The message with suggested FAQ metadata */
  message: Message;

  /** Callback when suggested FAQ is sent */
  onSend: (templateId: string, answer: string) => Promise<void>;
}

/**
 * Button component for sending suggested FAQ responses
 *
 * @component
 *
 * @remarks
 * - Only renders when message.metadata.suggestedFAQ is present
 * - Displays FAQ question and confidence score
 * - Shows "Send FAQ" button with loading state
 * - Calls onSend callback when button is pressed
 * - Provides visual feedback during send operation
 *
 * Design:
 * - Background: Light blue (#E3F2FD)
 * - Border: Blue accent (#007AFF)
 * - Icon: Lightbulb for suggestion indicator
 * - Confidence: Displayed as percentage
 * - Button: Primary blue when ready, loading spinner when sending
 *
 * @example
 * ```tsx
 * <SuggestedFAQButton
 *   message={messageData}
 *   onSend={handleSendSuggestedFAQ}
 * />
 * ```
 *
 * @param props - Component props
 * @returns SuggestedFAQButton component or null if no suggestion
 */
export const SuggestedFAQButton: FC<SuggestedFAQButtonProps> = ({ message, onSend }) => {
  const { theme } = useTheme();
  const [isSending, setIsSending] = useState(false);

  // Only show button for messages with suggested FAQ
  const suggestedFAQ = message.metadata?.suggestedFAQ;
  if (!suggestedFAQ) {
    return null;
  }

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.accentLight || '#E3F2FD',
      borderColor: theme.colors.accent,
    },
    headerIcon: {
      color: theme.colors.accent,
    },
    headerText: {
      color: theme.colors.accent,
    },
    confidenceBadge: {
      backgroundColor: theme.colors.accent,
    },
    question: {
      color: theme.colors.textPrimary,
    },
    sendButton: {
      backgroundColor: theme.colors.accent,
    },
  });

  const handleSend = async () => {
    setIsSending(true);

    try {
      await onSend(suggestedFAQ.templateId, suggestedFAQ.answer);
      // Success feedback is handled by parent component
    } catch (error) {
      console.error('Error sending suggested FAQ:', error);
      Alert.alert(
        'Error',
        'Failed to send FAQ response. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSending(false);
    }
  };

  const confidencePercentage = Math.round(suggestedFAQ.confidence * 100);

  return (
    <View style={[styles.container, dynamicStyles.container]} testID="suggested-faq-button">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bulb" size={16} color={dynamicStyles.headerIcon.color} />
          <Text style={[styles.headerText, dynamicStyles.headerText]}>Suggested FAQ</Text>
        </View>
        <View style={[styles.confidenceBadge, dynamicStyles.confidenceBadge]}>
          <Text style={styles.confidenceText}>{confidencePercentage}% match</Text>
        </View>
      </View>

      <Text style={[styles.question, dynamicStyles.question]} numberOfLines={2}>
        {suggestedFAQ.question}
      </Text>

      <TouchableOpacity
        style={[styles.sendButton, dynamicStyles.sendButton, isSending && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={isSending}
        testID="send-faq-button"
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="send" size={16} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>Send FAQ Response</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginLeft: 12,
    marginRight: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  question: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 18,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
