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
}) => {
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

  const isSendDisabled = !text.trim() || sending || disabled;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!sending && !disabled}
          testID="message-input"
        />

        {/* Character counter */}
        <Text
          style={[styles.charCount, text.length >= MAX_MESSAGE_LENGTH && styles.charCountLimit]}
        >
          {text.length}/{MAX_MESSAGE_LENGTH}
        </Text>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={isSendDisabled}
        testID="send-button"
      >
        {sending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={20} color={isSendDisabled ? '#8E8E93' : '#FFFFFF'} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    alignItems: 'flex-end',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: '#000000',
    maxHeight: 80,
  },
  charCount: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  charCountLimit: {
    color: '#FF3B30', // Red when at limit
    fontWeight: '600',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
});
