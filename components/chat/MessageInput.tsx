/**
 * MessageInput component for composing and sending chat messages
 *
 * @remarks
 * Provides a text input field with send button and character counter.
 * Enforces 1000 character limit and handles message submission.
 * Publishes typing state to Firebase Realtime Database.
 */

import React, { FC, useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { typingService } from '@/services/typingService';

/** Maximum allowed message length in characters */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Props for the MessageInput component
 */
export interface MessageInputProps {
  /** Callback function called when user sends a message */
  onSend: (text: string) => Promise<void>;

  /** ID of the conversation this input is for */
  conversationId: string;

  /** ID of the current user */
  userId: string;

  /** Whether the input should be disabled (optional) */
  disabled?: boolean;

  /** Callback for generating AI draft (optional) */
  onGenerateDraft?: () => void;

  /** Whether AI draft is currently being generated (optional) */
  isGeneratingDraft?: boolean;

  /** Whether the generate draft button should be shown (optional) */
  canGenerateDraft?: boolean;

  /** Draft text to populate the input field (optional) */
  draftText?: string;
}

/**
 * Message input component with send button and character counter
 *
 * @component
 *
 * @remarks
 * - Multiline text input with 1000 character limit
 * - Send button disabled when input is empty or only whitespace
 * - Character counter displays current/max characters
 * - Clears input after successful send
 * - Shows loading indicator while sending
 * - Displays error alert if send fails
 * - Publishes typing state when user types (debounced 300ms)
 * - Clears typing state when message sent or user stops typing
 *
 * @example
 * ```tsx
 * <MessageInput
 *   onSend={async (text) => {
 *     await messageService.sendMessage(conversationId, userId, text);
 *   }}
 *   conversationId="conv123"
 *   userId="user456"
 * />
 * ```
 */
export const MessageInput: FC<MessageInputProps> = ({
  onSend,
  conversationId,
  userId,
  disabled = false,
  onGenerateDraft,
  isGeneratingDraft = false,
  canGenerateDraft = false,
  draftText,
}) => {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Track typing state
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Handles text input changes and manages typing state
   * @param newText - The updated text value
   */
  const handleTextChange = (newText: string) => {
    setText(newText);

    // If user starts typing manually, hide AI suggestions (AC: IV1)

    // If text is empty, stop typing
    if (!newText.trim()) {
      if (isTypingRef.current) {
        typingService.setTyping(conversationId, userId, false);
        isTypingRef.current = false;
      }

      // Clear any pending timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // User is typing - publish state if not already published
    if (!isTypingRef.current) {
      typingService.setTyping(conversationId, userId, true);
      isTypingRef.current = true;
    }

    // Reset 3-second auto-clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        typingService.setTyping(conversationId, userId, false);
        isTypingRef.current = false;
      }
    }, 3000);
  };

  /**
   * Handles send button press
   * Validates input, calls onSend callback, and clears input on success
   * Immediately clears typing state when message is sent
   */
  const handleSend = async () => {
    const trimmedText = text.trim();

    // Validate input
    if (!trimmedText) {
      return;
    }

    setSending(true);
    try {
      await onSend(trimmedText);

      // Clear input on successful send
      setText('');

      // IMMEDIATELY clear typing state
      if (isTypingRef.current) {
        typingService.setTyping(conversationId, userId, false);
        isTypingRef.current = false;
      }

      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      // Show error to user
      console.error('Failed to send message:', error);
      Alert.alert('Failed to send message', 'Please check your connection and try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setSending(false);
    }
  };


  /**
   * Cleanup typing state on unmount or navigation
   */
  useEffect(() => {
    return () => {
      // Clear typing state when component unmounts
      if (isTypingRef.current) {
        typingService.setTyping(conversationId, userId, false);
      }

      // Clear any pending timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, userId]);

  /**
   * Populate input field when draftText prop changes
   */
  useEffect(() => {
    if (draftText) {
      setText(draftText);
    }
  }, [draftText]);

  const isSendDisabled = !text.trim() || sending || disabled;

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.borderLight,
    },
    inputContainer: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    input: {
      color: theme.colors.textPrimary,
    },
    charCount: {
      color: theme.colors.textSecondary,
    },
    charCountLimit: {
      color: theme.colors.error,
    },
    sendButton: {
      backgroundColor: theme.colors.accent,
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.disabled,
    },
  });

  return (
    <View>
      {/* Message Input Container */}
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={[styles.inputContainer, dynamicStyles.inputContainer]}>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            editable={!sending && !disabled}
            testID="message-input"
          />

          {/* Bottom row with AI button and character counter */}
          <View style={styles.bottomRow}>
            {/* AI Draft button - shown when canGenerateDraft is true */}
            {canGenerateDraft && (
              <TouchableOpacity
                style={styles.draftButton}
                onPress={onGenerateDraft}
                disabled={isGeneratingDraft || disabled}
                testID="generate-draft-button"
              >
                {isGeneratingDraft ? (
                  <ActivityIndicator size="small" color="#8B5CF6" />
                ) : (
                  <Ionicons name="sparkles" size={18} color="#8B5CF6" />
                )}
              </TouchableOpacity>
            )}

            {/* Character counter */}
            <Text
              style={[
                styles.charCount,
                dynamicStyles.charCount,
                text.length >= MAX_MESSAGE_LENGTH && dynamicStyles.charCountLimit,
              ]}
            >
              {text.length}/{MAX_MESSAGE_LENGTH}
            </Text>
          </View>
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButton, dynamicStyles.sendButton, isSendDisabled && dynamicStyles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSendDisabled}
          testID="send-button"
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color={isSendDisabled ? theme.colors.textTertiary : '#FFFFFF'} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 44,
    maxHeight: 150,
  },
  input: {
    fontSize: 17,
    lineHeight: 22,
    paddingBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 6,
    minHeight: 20,
  },
  charCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  charCountLimit: {
    fontWeight: '600',
  },
  draftButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 24,
    minHeight: 24,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
