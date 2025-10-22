/**
 * Unit tests for SearchResultItem component
 *
 * @group unit
 * @group components
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchResultItem } from '@/components/chat/SearchResultItem';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

describe('SearchResultItem', () => {
  const mockOnPress = jest.fn();

  const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    text: 'This is a test message that should be displayed in the search results',
    status: 'delivered',
    readBy: ['user-1'],
    timestamp: Timestamp.now(),
    metadata: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render message preview text', () => {
    const { getByText } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
      />
    );

    expect(getByText(/This is a test message/)).toBeTruthy();
  });

  it('should display sender name', () => {
    const { getByText } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
      />
    );

    expect(getByText('John Doe')).toBeTruthy();
  });

  it('should display conversation name with "in" prefix', () => {
    const { getByText } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
      />
    );

    expect(getByText('in Test Conversation')).toBeTruthy();
  });

  it('should truncate long message text to 100 characters', () => {
    const longMessage: Message = {
      ...mockMessage,
      text: 'A'.repeat(150),
    };

    const { getByTestID } = render(
      <SearchResultItem
        message={longMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    const preview = getByTestID('search-result-preview');
    expect(preview.props.children).toHaveLength(104); // 100 chars + '...'
    expect(preview.props.children).toMatch(/\.\.\.$/);
  });

  it('should not truncate short message text', () => {
    const shortMessage: Message = {
      ...mockMessage,
      text: 'Short message',
    };

    const { getByTestID } = render(
      <SearchResultItem
        message={shortMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    const preview = getByTestID('search-result-preview');
    expect(preview.props.children).toBe('Short message');
    expect(preview.props.children).not.toMatch(/\.\.\.$/);
  });

  it('should display sender photo when provided', () => {
    const { getByTestID } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        senderPhotoURL="https://example.com/photo.jpg"
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    const avatar = getByTestID('search-result-avatar');
    expect(avatar).toBeTruthy();
    expect(avatar.props.source.uri).toBe('https://example.com/photo.jpg');
  });

  it('should display avatar placeholder when no photo provided', () => {
    const { getByTestID, getByText } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    const placeholder = getByTestID('search-result-avatar-placeholder');
    expect(placeholder).toBeTruthy();

    // Should show first letter of sender name
    expect(getByText('J')).toBeTruthy();
  });

  it('should call onPress when item is tapped', () => {
    const { getByTestID } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    const item = getByTestID('search-result');
    fireEvent.press(item);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('should display relative timestamp', () => {
    const { getByText } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        onPress={mockOnPress}
      />
    );

    // Should show "Just now" for recent timestamps
    expect(getByText('Just now')).toBeTruthy();
  });

  it('should handle sender name with multiple words for avatar', () => {
    const { getByText } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Paul Doe"
        onPress={mockOnPress}
      />
    );

    // Should use first letter of first name
    expect(getByText('J')).toBeTruthy();
  });

  it('should handle empty sender name gracefully', () => {
    const { getByTestID } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName=""
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    const placeholder = getByTestID('search-result-avatar-placeholder');
    expect(placeholder).toBeTruthy();
  });

  it('should use testID for sub-components', () => {
    const { getByTestID } = render(
      <SearchResultItem
        message={mockMessage}
        conversationName="Test Conversation"
        senderName="John Doe"
        senderPhotoURL="https://example.com/photo.jpg"
        onPress={mockOnPress}
        testID="search-result"
      />
    );

    expect(getByTestID('search-result')).toBeTruthy();
    expect(getByTestID('search-result-avatar')).toBeTruthy();
    expect(getByTestID('search-result-preview')).toBeTruthy();
  });
});
