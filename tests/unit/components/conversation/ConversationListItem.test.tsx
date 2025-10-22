/**
 * Unit tests for ConversationListItem component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConversationListItem } from '@/components/conversation/ConversationListItem';
import { Timestamp } from 'firebase/firestore';
import type { Conversation } from '@/types/models';

// Mock Firebase Timestamp
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
  },
}));

// Mock the dateHelpers module
jest.mock('@/utils/dateHelpers', () => ({
  formatRelativeTime: jest.fn(() => '5m ago'),
}));

describe('ConversationListItem', () => {
  const mockConversation: Conversation = {
    id: 'conv123',
    type: 'direct',
    participantIds: ['user1', 'user2'],
    lastMessage: {
      text: 'Hello, how are you doing today?',
      senderId: 'user2',
      timestamp: Timestamp.now(),
    },
    lastMessageTimestamp: Timestamp.now(),
    unreadCount: { user1: 3, user2: 0 },
    archivedBy: {},
    deletedBy: {},
    mutedBy: {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const defaultProps = {
    conversation: mockConversation,
    currentUserId: 'user1',
    otherParticipantName: 'Jane Smith',
    otherParticipantPhoto: 'https://example.com/photo.jpg',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders participant display name', () => {
    const { getByText } = render(<ConversationListItem {...defaultProps} />);

    expect(getByText('Jane Smith')).toBeTruthy();
  });

  it('renders last message preview', () => {
    const { getByText } = render(<ConversationListItem {...defaultProps} />);

    expect(getByText('Hello, how are you doing today?')).toBeTruthy();
  });

  it('truncates last message preview to 50 characters', () => {
    const longMessage =
      'This is a very long message that should be truncated because it exceeds fifty characters';
    const conversationWithLongMessage: Conversation = {
      ...mockConversation,
      lastMessage: {
        ...mockConversation.lastMessage,
        text: longMessage,
      },
    };

    const { getByText } = render(
      <ConversationListItem {...defaultProps} conversation={conversationWithLongMessage} />
    );

    const truncatedText = `${longMessage.substring(0, 50)}...`;
    expect(getByText(truncatedText)).toBeTruthy();
  });

  it('displays relative timestamp', () => {
    const { getByText } = render(<ConversationListItem {...defaultProps} />);

    // Should display mocked timestamp
    expect(getByText('5m ago')).toBeTruthy();
  });

  it('displays unread badge when count > 0', () => {
    const { getByTestId, getByText } = render(<ConversationListItem {...defaultProps} />);

    expect(getByTestId('badge')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('hides unread badge when count = 0', () => {
    const conversationWithNoUnread: Conversation = {
      ...mockConversation,
      unreadCount: { user1: 0, user2: 0 },
    };

    const { queryByTestId } = render(
      <ConversationListItem {...defaultProps} conversation={conversationWithNoUnread} />
    );

    expect(queryByTestId('badge')).toBeNull();
  });

  it('calls onPress with conversation ID when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<ConversationListItem {...defaultProps} onPress={onPress} />);

    fireEvent.press(getByTestId('conversation-item'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('conv123');
  });

  it('renders Avatar component with correct props', () => {
    const { getByTestId } = render(<ConversationListItem {...defaultProps} />);

    // Avatar should be rendered
    const avatar = getByTestId('avatar-image');
    expect(avatar).toBeTruthy();
  });

  it('handles null participant photo', () => {
    const { getByTestId } = render(
      <ConversationListItem {...defaultProps} otherParticipantPhoto={null} />
    );

    // Should render fallback avatar
    const fallback = getByTestId('avatar-fallback');
    expect(fallback).toBeTruthy();
  });

  it('handles zero unread count correctly', () => {
    const conversationWithZeroUnread: Conversation = {
      ...mockConversation,
      unreadCount: {},
    };

    const { queryByTestId } = render(
      <ConversationListItem {...defaultProps} conversation={conversationWithZeroUnread} />
    );

    expect(queryByTestId('badge')).toBeNull();
  });

  it('handles different user as current user', () => {
    const { queryByTestId } = render(
      <ConversationListItem {...defaultProps} currentUserId="user2" />
    );

    // User2 has 0 unread, so badge should not be displayed
    expect(queryByTestId('badge')).toBeNull();
  });
});
