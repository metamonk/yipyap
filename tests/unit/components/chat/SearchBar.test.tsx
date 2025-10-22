/**
 * Unit tests for SearchBar component
 *
 * @group unit
 * @group components
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SearchBar } from '@/components/chat/SearchBar';

describe('SearchBar', () => {
  const mockOnSearch = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render search input and icon', () => {
    const { getByTestID, getByPlaceholderText } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    expect(getByTestID('search-bar')).toBeTruthy();
    expect(getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('should render with custom placeholder', () => {
    const { getByPlaceholderText } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} placeholder="Search messages..." />
    );

    expect(getByPlaceholderText('Search messages...')).toBeTruthy();
  });

  it('should update input value when user types', () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    fireEvent.changeText(input, 'hello');

    expect(input.props.value).toBe('hello');
  });

  it('should call onSearch after debounce delay (300ms)', async () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    fireEvent.changeText(input, 'hello');

    // Should not call immediately
    expect(mockOnSearch).not.toHaveBeenCalled();

    // Fast-forward time by 300ms
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('hello');
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });
  });

  it('should debounce multiple rapid changes', async () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    // Simulate rapid typing
    fireEvent.changeText(input, 'h');
    jest.advanceTimersByTime(100);

    fireEvent.changeText(input, 'he');
    jest.advanceTimersByTime(100);

    fireEvent.changeText(input, 'hel');
    jest.advanceTimersByTime(100);

    fireEvent.changeText(input, 'hello');

    // Should still not have called onSearch
    expect(mockOnSearch).not.toHaveBeenCalled();

    // Fast-forward past debounce delay
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      // Should only call once with final value
      expect(mockOnSearch).toHaveBeenCalledWith('hello');
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });
  });

  it('should show clear button when text is entered', () => {
    const { getByTestID, queryByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    // Clear button should not be visible initially
    expect(queryByTestID('search-bar-clear-button')).toBeNull();

    // Enter text
    const input = getByTestID('search-bar-input');
    fireEvent.changeText(input, 'hello');

    // Clear button should now be visible
    expect(getByTestID('search-bar-clear-button')).toBeTruthy();
  });

  it('should hide clear button when text is cleared', () => {
    const { getByTestID, queryByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    // Enter text
    fireEvent.changeText(input, 'hello');
    expect(getByTestID('search-bar-clear-button')).toBeTruthy();

    // Clear text
    fireEvent.changeText(input, '');
    expect(queryByTestID('search-bar-clear-button')).toBeNull();
  });

  it('should call onClear when clear button is pressed', () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    // Enter text
    fireEvent.changeText(input, 'hello');

    // Press clear button
    const clearButton = getByTestID('search-bar-clear-button');
    fireEvent.press(clearButton);

    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it('should reset input value when clear button is pressed', () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    // Enter text
    fireEvent.changeText(input, 'hello');
    expect(input.props.value).toBe('hello');

    // Press clear button
    const clearButton = getByTestID('search-bar-clear-button');
    fireEvent.press(clearButton);

    expect(input.props.value).toBe('');
  });

  it('should disable input when disabled prop is true', () => {
    const { getByTestID } = render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        disabled={true}
        testID="search-bar"
      />
    );

    const input = getByTestID('search-bar-input');
    expect(input.props.editable).toBe(false);
  });

  it('should not show clear button when disabled', () => {
    const { getByTestID, queryByTestID } = render(
      <SearchBar
        onSearch={mockOnSearch}
        onClear={mockOnClear}
        disabled={true}
        testID="search-bar"
      />
    );

    const input = getByTestID('search-bar-input');

    // Try to enter text (won't work because disabled)
    fireEvent.changeText(input, 'hello');

    // Clear button should not appear
    expect(queryByTestID('search-bar-clear-button')).toBeNull();
  });

  it('should handle empty string gracefully', async () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    fireEvent.changeText(input, '');

    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('');
    });
  });

  it('should handle special characters in input', async () => {
    const { getByTestID } = render(
      <SearchBar onSearch={mockOnSearch} onClear={mockOnClear} testID="search-bar" />
    );

    const input = getByTestID('search-bar-input');

    const specialChars = '@#$%^&*()';
    fireEvent.changeText(input, specialChars);

    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith(specialChars);
    });
  });
});
