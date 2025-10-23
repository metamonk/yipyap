/**
 * Unit tests for ConversationListItem delete functionality
 * @module tests/unit/components/ConversationListItem.delete
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConversationListItem } from '@/components/conversation/ConversationListItem';
import type { Conversation } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/components/common/Avatar', () => ({
  Avatar: 'Avatar',
}));

jest.mock('@/components/common/CompositeAvatar', () => ({
  CompositeAvatar: 'CompositeAvatar',
}));

jest.mock('@/components/common/Badge', () => ({
  Badge: 'Badge',
}));

jest.mock('@/components/PresenceIndicator', () => ({
  PresenceIndicator: 'PresenceIndicator',
}));

jest.mock('@/utils/dateHelpers', () => ({
  formatRelativeTime: () => '5m ago',
}));

// Mock Swipeable from react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: ({ children, renderRightActions }: any) => {
      return (
        <View>
          {children}
          {renderRightActions && <View testID="swipe-actions">{renderRightActions()}</View>}
        </View>
      );
    },
  };
});

describe('ConversationListItem - Delete Functionality', () => {
  const mockOnPress = jest.fn();
  const mockOnArchive = jest.fn();
  const mockOnDelete = jest.fn();

  const mockConversation: Conversation = {
    id: 'test-conversation',
    type: 'direct',
    participantIds: ['user1', 'user2'],
    lastMessage: {
      text: 'Hello, world!',
      senderId: 'user2',
      timestamp: Timestamp.now(),
    },
    lastMessageTimestamp: Timestamp.now(),
    unreadCount: {
      user1: 2,
      user2: 0,
    },
    archivedBy: {
      user1: false,
      user2: false,
    },
    deletedBy: {
      user1: false,
      user2: false,
    },
    mutedBy: {
      user1: false,
      user2: false,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Delete Button Rendering', () => {
    it('should render delete button when onDelete prop is provided', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onDelete={mockOnDelete}
        />
      );

      const swipeActions = getByTestId('swipe-actions');
      expect(swipeActions).toBeTruthy();

      const deleteButton = getByTestId('delete-button');
      expect(deleteButton).toBeTruthy();
    });

    it('should not render delete button when onDelete prop is not provided', () => {
      const { queryByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
        />
      );

      const deleteButton = queryByTestId('delete-button');
      expect(deleteButton).toBeNull();
    });

    it('should render both archive and delete buttons when both props provided', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onArchive={mockOnArchive}
          onDelete={mockOnDelete}
        />
      );

      const archiveButton = getByTestId('archive-button');
      const deleteButton = getByTestId('delete-button');

      expect(archiveButton).toBeTruthy();
      expect(deleteButton).toBeTruthy();
    });
  });

  describe('Delete Button Interaction', () => {
    it('should call onDelete with conversation ID when delete button is pressed', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = getByTestId('delete-button');
      fireEvent.press(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('test-conversation');
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when delete button is pressed', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = getByTestId('delete-button');
      fireEvent.press(deleteButton);

      expect(mockOnDelete).toHaveBeenCalled();
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should call onDelete independently from onArchive', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onArchive={mockOnArchive}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = getByTestId('delete-button');
      fireEvent.press(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('test-conversation');
      expect(mockOnArchive).not.toHaveBeenCalled();
    });
  });

  describe('Delete Button Styling', () => {
    it('should have destructive (red) background color', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = getByTestId('delete-button');
      const styles = deleteButton.props.style;

      // Verify red background color (#FF3B30)
      expect(styles).toMatchObject(
        expect.objectContaining({
          backgroundColor: '#FF3B30',
        })
      );
    });

    it('should display trash icon and "Delete" text', () => {
      const { getByTestId, getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Test User"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = getByTestId('delete-button');
      expect(deleteButton).toBeTruthy();

      const deleteText = getByText('Delete');
      expect(deleteText).toBeTruthy();
    });
  });

  describe('Group Conversations', () => {
    const groupConversation: Conversation = {
      ...mockConversation,
      id: 'test-group',
      type: 'group',
      groupName: 'Test Group',
      participantIds: ['user1', 'user2', 'user3'],
    };

    it('should support delete action for group conversations', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={groupConversation}
          currentUserId="user1"
          otherParticipantName="Test Group"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = getByTestId('delete-button');
      fireEvent.press(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('test-group');
    });
  });
});
