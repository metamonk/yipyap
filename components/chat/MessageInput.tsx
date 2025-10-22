/**
 * MessageInput component for composing and sending chat messages
 *
 * @remarks
 * Provides a text input field with send button and character counter.
 * Enforces 1000 character limit and handles message submission.
 */

import React, { FC, useState } from 'react';
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

/** Maximum allowed message length in characters */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Props for the MessageInput component
 */
export interface MessageInputProps {
  /** Callback function called when user sends a message */
  onSend: (text: string) => Promise<void>;

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
 *
 * @example
 * ```tsx
 * <MessageInput
 *   onSend={async (text) => {
 *     await messageService.sendMessage(conversationId, userId, text);
 *   }}
 * />
 * ```
 */
export const MessageInput: FC<MessageInputProps> = ({ onSend, disabled = false }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  /**
   * Handles send button press
   * Validates input, calls onSend callback, and clears input on success
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

  const isSendDisabled = !text.trim() || sending || disabled;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
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
