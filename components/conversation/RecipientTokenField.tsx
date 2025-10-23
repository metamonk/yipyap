/**
 * RecipientTokenField Component
 *
 * @remarks
 * A tokenized input field that displays selected recipients as chips/tokens
 * and allows searching for new recipients. Core component of the unified
 * conversation creation flow.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Keyboard,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecipientChip } from './RecipientChip';
import type { User } from '@/types/user';

interface RecipientTokenFieldProps {
  recipients: User[];
  onRecipientsChange: (recipients: User[]) => void;
  onSearchQueryChange: (query: string) => void;
  onAddPress: () => void;
  searchQuery: string;
  maxRecipients?: number;
  placeholder?: string;
  isDisabled?: boolean;
  error?: string;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * RecipientTokenField provides a tokenized interface for selecting message recipients
 *
 * @component
 * @example
 * ```tsx
 * <RecipientTokenField
 *   recipients={selectedUsers}
 *   onRecipientsChange={setSelectedUsers}
 *   onSearchQueryChange={setSearchQuery}
 *   onAddPress={openContactPicker}
 *   searchQuery={searchQuery}
 *   maxRecipients={10}
 * />
 * ```
 */
export const RecipientTokenField: React.FC<RecipientTokenFieldProps> = ({
  recipients,
  onRecipientsChange,
  onSearchQueryChange,
  onAddPress,
  searchQuery,
  maxRecipients = 10,
  placeholder = 'Search users...',
  isDisabled = false,
  error,
  autoFocus = false,
  testID,
}) => {
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerHeight, setContainerHeight] = useState(44);

  const isMaxReached = recipients.length >= maxRecipients;
  const showPlaceholder = recipients.length === 0 && !searchQuery;

  // Auto-scroll to end when recipients change
  useEffect(() => {
    if (scrollViewRef.current && recipients.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [recipients.length]);

  const handleRemoveRecipient = useCallback((user: User) => {
    const newRecipients = recipients.filter((r) => r.uid !== user.uid);
    onRecipientsChange(newRecipients);

    // Focus input after removing a chip
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [recipients, onRecipientsChange]);

  const handleKeyPress = useCallback(({ nativeEvent }: any) => {
    // Handle backspace to remove last recipient when input is empty
    if (nativeEvent.key === 'Backspace' && !searchQuery && recipients.length > 0) {
      const lastRecipient = recipients[recipients.length - 1];
      handleRemoveRecipient(lastRecipient);
    }
  }, [searchQuery, recipients, handleRemoveRecipient]);

  const handleInputFocus = () => {
    // Scroll to end when input is focused
    if (scrollViewRef.current && recipients.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  };

  const handleContentSizeChange = (width: number, height: number) => {
    // Limit maximum height and enable scrolling
    const maxHeight = 120;
    const minHeight = 44;
    const newHeight = Math.min(Math.max(height, minHeight), maxHeight);
    setContainerHeight(newHeight);
  };

  // Accessibility announcement for recipient count
  useEffect(() => {
    if (recipients.length > 0) {
      const message = recipients.length === 1
        ? `1 recipient selected`
        : `${recipients.length} recipients selected`;
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [recipients.length]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>To:</Text>
      </View>

      <View style={[styles.fieldContainer, error && styles.fieldError]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal={false}
          style={[styles.scrollView, { maxHeight: containerHeight }]}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={handleContentSizeChange}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.chipsContainer}>
            {recipients.map((recipient, index) => (
              <RecipientChip
                key={recipient.uid}
                user={recipient}
                onRemove={handleRemoveRecipient}
                index={index}
                testID={`${testID}-chip-${index}`}
              />
            ))}

            {!isMaxReached && (
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  recipients.length === 0 && styles.inputEmpty,
                ]}
                placeholder={showPlaceholder ? placeholder : ''}
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                onKeyPress={handleKeyPress}
                onFocus={handleInputFocus}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={autoFocus}
                editable={!isDisabled && !isMaxReached}
                returnKeyType="search"
                accessibilityLabel="Search for recipients"
                accessibilityHint={
                  recipients.length > 0
                    ? `${recipients.length} recipients selected. Type to search for more.`
                    : 'Type to search for users'
                }
                testID={`${testID}-input`}
              />
            )}

            {isMaxReached && (
              <Text style={styles.maxReachedText}>
                Maximum {maxRecipients} recipients
              </Text>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.addButton, isDisabled && styles.addButtonDisabled]}
          onPress={onAddPress}
          disabled={isDisabled || isMaxReached}
          accessibilityLabel="Add from contacts"
          accessibilityRole="button"
          testID={`${testID}-add-button`}
        >
          <Ionicons
            name="add-circle"
            size={28}
            color={isDisabled || isMaxReached ? '#C7C7CC' : '#007AFF'}
          />
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    minHeight: 44,
  },
  fieldError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 120,
    height: 32,
    fontSize: 16,
    color: '#000000',
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  inputEmpty: {
    minWidth: 200,
  },
  addButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  maxReachedText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});