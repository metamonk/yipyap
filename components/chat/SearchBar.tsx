import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  /** Callback fired when search query changes (debounced by 300ms) */
  onSearch: (query: string) => void;

  /** Callback fired when clear/cancel button is pressed */
  onClear: () => void;

  /** Placeholder text for the search input */
  placeholder?: string;

  /** Whether the search bar is disabled */
  disabled?: boolean;

  /** Test ID for automated testing */
  testID?: string;
}

const DEBOUNCE_DELAY = 300; // milliseconds

/**
 * Search input component with debounced search and clear functionality
 *
 * @component
 * @remarks
 * This component provides a search interface with iOS-style design consistent
 * with other input components in the app. It includes:
 * - Search icon on the left
 * - Text input field with debounced onChange
 * - Clear/cancel button on the right (only shown when text is entered)
 * - 300ms debounce to reduce search frequency
 *
 * Performance optimizations:
 * - Memoized with React.memo to prevent unnecessary re-renders
 * - Debounced search to reduce parent re-renders
 * - useCallback for event handlers
 *
 * @example
 * ```tsx
 * <SearchBar
 *   onSearch={(query) => console.log('Search:', query)}
 *   onClear={() => console.log('Clear search')}
 *   placeholder="Search messages..."
 *   testID="message-search-bar"
 * />
 * ```
 */
export const SearchBar = memo<SearchBarProps>(
  ({ onSearch, onClear, placeholder = 'Search...', disabled = false, testID }) => {
    const [inputValue, setInputValue] = useState('');
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced search effect
    useEffect(() => {
      // Clear any existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer for debounced search
      debounceTimerRef.current = setTimeout(() => {
        onSearch(inputValue);
      }, DEBOUNCE_DELAY);

      // Cleanup function to clear timer on unmount or input change
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [inputValue, onSearch]);

    /**
     * Handles text input changes
     */
    const handleChangeText = useCallback((text: string) => {
      setInputValue(text);
    }, []);

    /**
     * Handles clear button press
     */
    const handleClear = useCallback(() => {
      setInputValue('');
      onClear();
    }, [onClear]);

    return (
      <View style={styles.container} testID={testID}>
        {/* Search Icon */}
        <Ionicons name="search" size={20} color={COLORS.secondaryText} style={styles.searchIcon} />

        {/* Search Input */}
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={inputValue}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.secondaryText}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID={testID ? `${testID}-input` : 'search-input'}
        />

        {/* Clear Button (only shown when there's text) */}
        {inputValue.length > 0 && !disabled && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID={testID ? `${testID}-clear-button` : 'search-clear-button'}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.secondaryText} />
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

SearchBar.displayName = 'SearchBar';

/**
 * Color palette for consistent styling
 */
const COLORS = {
  primary: '#007AFF', // iOS blue
  background: '#FFFFFF',
  secondaryBg: '#F2F2F7', // Input background
  border: '#E5E5EA',
  text: '#000000',
  secondaryText: '#8E8E93', // Placeholder, timestamps
  disabled: '#C7C7CC',
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 0, // Remove default padding for consistent height
  },
  inputDisabled: {
    color: COLORS.disabled,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
});
