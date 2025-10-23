/**
 * RecipientTokenField Component Tests
 *
 * @remarks
 * Tests for the tokenized recipient field component including
 * chip rendering, selection, removal, and search functionality.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RecipientTokenField } from '@/components/conversation/RecipientTokenField';
import type { User } from '@/types/user';

// Mock users for testing
const mockUsers: User[] = [
  {
    uid: '1',
    email: 'john@example.com',
    username: 'johndoe',
    displayName: 'John Doe',
    photoURL: null,
    bio: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnline: true,
    lastSeen: new Date(),
  },
  {
    uid: '2',
    email: 'jane@example.com',
    username: 'janedoe',
    displayName: 'Jane Doe',
    photoURL: null,
    bio: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnline: false,
    lastSeen: new Date(),
  },
];

describe('RecipientTokenField', () => {
  const defaultProps = {
    recipients: [],
    onRecipientsChange: jest.fn(),
    onSearchQueryChange: jest.fn(),
    onAddPress: jest.fn(),
    searchQuery: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with no recipients', () => {
    const { getByPlaceholderText, getByText } = render(
      <RecipientTokenField {...defaultProps} />
    );

    expect(getByText('To:')).toBeTruthy();
    expect(getByPlaceholderText('Search users...')).toBeTruthy();
  });

  it('renders recipient chips correctly', () => {
    const { getByText } = render(
      <RecipientTokenField
        {...defaultProps}
        recipients={mockUsers}
      />
    );

    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('Jane Doe')).toBeTruthy();
  });

  it('handles search input changes', () => {
    const onSearchQueryChange = jest.fn();
    const { getByPlaceholderText } = render(
      <RecipientTokenField
        {...defaultProps}
        onSearchQueryChange={onSearchQueryChange}
      />
    );

    const input = getByPlaceholderText('Search users...');
    fireEvent.changeText(input, 'test query');

    expect(onSearchQueryChange).toHaveBeenCalledWith('test query');
  });

  it('handles add button press', () => {
    const onAddPress = jest.fn();
    const { getByTestId } = render(
      <RecipientTokenField
        {...defaultProps}
        onAddPress={onAddPress}
        testID="recipient-field"
      />
    );

    const addButton = getByTestId('recipient-field-add-button');
    fireEvent.press(addButton);

    expect(onAddPress).toHaveBeenCalled();
  });

  it('handles recipient removal', async () => {
    const onRecipientsChange = jest.fn();
    const { getByTestId } = render(
      <RecipientTokenField
        {...defaultProps}
        recipients={[mockUsers[0]]}
        onRecipientsChange={onRecipientsChange}
        testID="recipient-field"
      />
    );

    const removeButton = getByTestId('recipient-field-chip-0-remove');
    fireEvent.press(removeButton);

    // Wait for animation to complete
    await waitFor(() => {
      expect(onRecipientsChange).toHaveBeenCalledWith([]);
    });
  });

  it('shows error message when provided', () => {
    const { getByText } = render(
      <RecipientTokenField
        {...defaultProps}
        error="Test error message"
      />
    );

    expect(getByText('Test error message')).toBeTruthy();
  });

  it('disables input when max recipients reached', () => {
    const { getByText, queryByPlaceholderText } = render(
      <RecipientTokenField
        {...defaultProps}
        recipients={Array(10).fill(mockUsers[0]).map((u, i) => ({ ...u, uid: `${i}` }))}
        maxRecipients={10}
      />
    );

    expect(queryByPlaceholderText('Search users...')).toBeFalsy();
    expect(getByText('Maximum 10 recipients')).toBeTruthy();
  });

  it('handles backspace to remove last recipient', () => {
    const onRecipientsChange = jest.fn();
    const { getByTestId } = render(
      <RecipientTokenField
        {...defaultProps}
        recipients={mockUsers}
        onRecipientsChange={onRecipientsChange}
        searchQuery=""
        testID="recipient-field"
      />
    );

    const input = getByTestId('recipient-field-input');
    fireEvent(input, 'onKeyPress', { nativeEvent: { key: 'Backspace' } });

    expect(onRecipientsChange).toHaveBeenCalledWith([mockUsers[0]]);
  });
});