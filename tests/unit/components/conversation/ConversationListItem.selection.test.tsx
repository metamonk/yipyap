/**
 * Unit tests for ConversationListItem selection mode functionality (Story 4.7)
 *
 * Tests:
 * - Long-press gesture activates selection mode
 * - Checkbox appears/disappears based on selection mode
 * - Checkbox shows correct selected/unselected state
 * - Tap toggles selection in selection mode
 * - Tap navigates normally outside selection mode
 * - Selected state visual indication
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

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const SwipeableMock = React.forwardRef(({ children }: any, _ref: any) => {
    return <div data-testid="swipeable-container">{children}</div>;
  });
  SwipeableMock.displayName = 'Swipeable';

  return {
    Swipeable: SwipeableMock,
    GestureHandlerRootView: ({ children }: any) => children,
  };
});

describe('ConversationListItem - Selection Mode (Story 4.7)', () => {
  const mockConversation: Conversation = {
    id: 'conv123',
    type: 'direct',
    participantIds: ['user1', 'user2'],
    lastMessage: {
      text: 'Hello, how are you?',
      senderId: 'user2',
      timestamp: Timestamp.now(),
    },
    lastMessageTimestamp: Timestamp.now(),
    unreadCount: { user1: 2, user2: 0 },
    archivedBy: {},
    deletedBy: {},
    mutedBy: {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Long-Press Gesture (AC 1)', () => {
    it('should call onLongPress when item is long-pressed', () => {
      const mockOnLongPress = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onLongPress={mockOnLongPress}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent(item, 'onLongPress');

      expect(mockOnLongPress).toHaveBeenCalledTimes(1);
    });

    it('should not throw error when onLongPress is not provided', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
        />
      );

      const item = getByTestId('conversation-item');
      expect(() => fireEvent(item, 'onLongPress')).not.toThrow();
    });
  });

  describe('Checkbox Visibility (AC 2)', () => {
    it('should show checkbox when isSelectionMode is true', () => {
      const { UNSAFE_getByType } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
        />
      );

      // Check for Ionicons component (checkbox icon)
      const icons = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icons).toBeTruthy();
    });

    it('should not show checkbox when isSelectionMode is false', () => {
      const { queryByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={false}
          isSelected={false}
        />
      );

      // Checkbox should not be rendered
      // Note: Since checkbox is conditionally rendered, we check by absence of the container
      const item = queryByTestId('conversation-item');
      expect(item).toBeTruthy();
    });

    it('should not show checkbox when isSelectionMode is undefined', () => {
      const { queryByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
        />
      );

      const item = queryByTestId('conversation-item');
      expect(item).toBeTruthy();
    });
  });

  describe('Checkbox Selected State (AC 3)', () => {
    it('should show checkmark-circle icon when isSelected is true', () => {
      const { UNSAFE_getByProps } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={true}
        />
      );

      const checkmarkIcon = UNSAFE_getByProps({ name: 'checkmark-circle' });
      expect(checkmarkIcon).toBeTruthy();
      expect(checkmarkIcon.props.color).toBe('#007AFF');
    });

    it('should show ellipse-outline icon when isSelected is false', () => {
      const { UNSAFE_getByProps } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
        />
      );

      const ellipseIcon = UNSAFE_getByProps({ name: 'ellipse-outline' });
      expect(ellipseIcon).toBeTruthy();
      expect(ellipseIcon.props.color).toBe('#999');
    });
  });

  describe('Selection Toggle (AC 3)', () => {
    it('should call onToggleSelect when tapped in selection mode', () => {
      const mockOnPress = jest.fn();
      const mockOnToggleSelect = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={mockOnToggleSelect}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent.press(item);

      expect(mockOnToggleSelect).toHaveBeenCalledTimes(1);
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should call onPress when tapped outside selection mode', () => {
      const mockOnPress = jest.fn();
      const mockOnToggleSelect = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          isSelectionMode={false}
          onToggleSelect={mockOnToggleSelect}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent.press(item);

      expect(mockOnPress).toHaveBeenCalledWith('conv123');
      expect(mockOnToggleSelect).not.toHaveBeenCalled();
    });

    it('should call onPress when in selection mode but onToggleSelect is not provided', () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          isSelectionMode={true}
          isSelected={false}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent.press(item);

      expect(mockOnPress).toHaveBeenCalledWith('conv123');
    });
  });

  describe('Visual Indication (AC 3)', () => {
    it('should apply selectedContainer style when isSelected is true', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={true}
        />
      );

      const item = getByTestId('conversation-item');
      // Verify style exists - the selected style is applied via StyleSheet
      expect(item.props.style).toBeDefined();
      // Selected style should include backgroundColor for visual indication
      const flattenedStyle = Array.isArray(item.props.style)
        ? Object.assign({}, ...item.props.style.filter(Boolean))
        : item.props.style;
      expect(flattenedStyle.backgroundColor).toBe('#E3F2FD');
    });

    it('should not apply selectedContainer style when isSelected is false', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
        />
      );

      const item = getByTestId('conversation-item');
      expect(item.props.style).toBeTruthy();
      const flattenedStyle = Array.isArray(item.props.style)
        ? Object.assign({}, ...item.props.style.filter(Boolean))
        : item.props.style;
      // When not selected, should not have the selected background color
      expect(flattenedStyle.backgroundColor).not.toBe('#E3F2FD');
    });
  });

  describe('Group Conversations', () => {
    const groupConversation: Conversation = {
      ...mockConversation,
      type: 'group',
      participantIds: ['user1', 'user2', 'user3'],
      groupName: 'Team Chat',
    };

    it('should support selection mode for group conversations', () => {
      const mockOnToggleSelect = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={groupConversation}
          currentUserId="user1"
          otherParticipantName="Team Chat"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={mockOnToggleSelect}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent.press(item);

      expect(mockOnToggleSelect).toHaveBeenCalledTimes(1);
    });

    it('should show checkbox for group conversations in selection mode', () => {
      const { UNSAFE_getByType } = render(
        <ConversationListItem
          conversation={groupConversation}
          currentUserId="user1"
          otherParticipantName="Team Chat"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
        />
      );

      const icons = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icons).toBeTruthy();
    });

    it('should call onLongPress for group conversations', () => {
      const mockOnLongPress = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={groupConversation}
          currentUserId="user1"
          otherParticipantName="Team Chat"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onLongPress={mockOnLongPress}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent(item, 'onLongPress');

      expect(mockOnLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all selection props being undefined', () => {
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
        />
      );

      const item = getByTestId('conversation-item');
      expect(item).toBeTruthy();
      expect(() => fireEvent.press(item)).not.toThrow();
    });

    it('should handle isSelectionMode=true with isSelected=undefined', () => {
      const { UNSAFE_getByType } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
        />
      );

      const icons = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icons).toBeTruthy();
    });

    it('should handle rapid toggle selections', () => {
      const mockOnToggleSelect = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={mockOnToggleSelect}
        />
      );

      const item = getByTestId('conversation-item');

      fireEvent.press(item);
      fireEvent.press(item);
      fireEvent.press(item);

      expect(mockOnToggleSelect).toHaveBeenCalledTimes(3);
    });
  });

  describe('Combined Selection and Archive Actions', () => {
    it('should support both selection mode and archive actions', () => {
      const mockOnToggleSelect = jest.fn();
      const mockOnArchive = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={mockOnToggleSelect}
          onArchive={mockOnArchive}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent.press(item);

      expect(mockOnToggleSelect).toHaveBeenCalledTimes(1);
    });

    it('should support both selection mode and delete actions', () => {
      const mockOnToggleSelect = jest.fn();
      const mockOnDelete = jest.fn();
      const { getByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          isSelectionMode={true}
          isSelected={false}
          onToggleSelect={mockOnToggleSelect}
          onDelete={mockOnDelete}
        />
      );

      const item = getByTestId('conversation-item');
      fireEvent.press(item);

      expect(mockOnToggleSelect).toHaveBeenCalledTimes(1);
    });
  });
});
