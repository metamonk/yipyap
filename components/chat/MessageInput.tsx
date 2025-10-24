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
import { onSnapshot, query, collection, orderBy, limit } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { typingService } from '@/services/typingService';
import { ResponseSuggestions } from './ResponseSuggestions';
import { voiceMatchingService } from '@/services/voiceMatchingService';
import { useAuth } from '@/hooks/useAuth';
import type { Message } from '@/types/models';

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
  const { userProfile } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Voice matching state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastIncomingMessageId, setLastIncomingMessageId] = useState<string | null>(null);

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
    if (newText.length > 0 && showSuggestions) {
      setShowSuggestions(false);
    }

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
   * Callback handlers for ResponseSuggestions component
   */
  const handleAcceptSuggestion = (suggestionText: string) => {
    // Populate input field with accepted suggestion
    setText(suggestionText);
    setShowSuggestions(false);

    // Track acceptance feedback for retraining (fire-and-forget with error handling)
    voiceMatchingService.trackFeedback({
      suggestion: suggestionText,
      action: 'accepted',
    }).catch((error) => {
      console.error('[MessageInput] Failed to track suggestion feedback:', error);
    });
  };

  const handleRejectSuggestion = (suggestionText: string) => {
    // Track rejection feedback for retraining (fire-and-forget with error handling)
    voiceMatchingService.trackFeedback({
      suggestion: suggestionText,
      action: 'rejected',
    }).catch((error) => {
      console.error('[MessageInput] Failed to track suggestion feedback:', error);
    });
  };

  const handleEditSuggestion = (suggestionText: string) => {
    // Populate input field for manual editing
    setText(suggestionText);
    setShowSuggestions(false);

    // Track edit feedback for retraining (fire-and-forget with error handling)
    voiceMatchingService.trackFeedback({
      suggestion: suggestionText,
      action: 'edited',
    }).catch((error) => {
      console.error('[MessageInput] Failed to track suggestion feedback:', error);
    });
  };

  const handleSuggestionsComplete = () => {
    // Hide suggestions when all processed
    setShowSuggestions(false);
  };

  /**
   * Subscribe to new incoming messages for AI suggestion generation
   * Listens to the last message in the conversation and triggers suggestion loading
   * when a new incoming message is detected (not from current user)
   */
  useEffect(() => {
    // Skip if no conversation ID or voice matching disabled
    if (!conversationId || !userProfile?.settings?.voiceMatching?.enabled) {
      return;
    }

    // Subscribe to the last message in this conversation
    const db = getFirebaseDb();
    const messagesQuery = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (snapshot.empty) {
          return;
        }

        const lastMessage = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        } as Message;

        // Only show suggestions for incoming messages (not sent by current user)
        // Don't show if user is already typing (AC: IV1 - non-blocking UI)
        if (
          lastMessage.senderId !== userId &&
          lastMessage.id !== lastIncomingMessageId &&
          userProfile.settings?.voiceMatching?.autoShowSuggestions &&
          !text.trim() // Don't show suggestions if user is already typing
        ) {
          setLastIncomingMessageId(lastMessage.id);
          setShowSuggestions(true);
        }
      },
      (error) => {
        console.error('Error listening for messages:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [conversationId, userId, userProfile, lastIncomingMessageId, text]);

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
    <View>
      {/* AI Response Suggestions - displayed above input when available */}
      {showSuggestions && lastIncomingMessageId && (
        <View testID="response-suggestions-container">
          <ResponseSuggestions
            conversationId={conversationId}
            incomingMessageId={lastIncomingMessageId}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
            onEdit={handleEditSuggestion}
            suggestionCount={userProfile?.settings?.voiceMatching?.suggestionCount || 2}
            visible={showSuggestions}
            onComplete={handleSuggestionsComplete}
          />
        </View>
      )}

      {/* Message Input Container */}
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
