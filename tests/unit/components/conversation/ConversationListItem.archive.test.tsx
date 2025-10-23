/**
 * Unit tests for ConversationListItem archive/unarchive swipe functionality
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
let mockSwipeableRef: any = null;

const createMockSwipeableRef = () => {
  mockSwipeableRef = {
    close: jest.fn(),
  };
  return mockSwipeableRef;
};

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');

  const MockSwipeable = React.forwardRef(({ children, renderRightActions }: any, ref: any) => {
    React.useEffect(() => {
      const swipeableRef = createMockSwipeableRef();
      if (ref && typeof ref === 'function') {
        ref(swipeableRef);
      } else if (ref && typeof ref === 'object') {
        ref.current = swipeableRef;
      }
    }, [ref]);

    return (
      <div data-testid="swipeable-container">
        {children}
        {renderRightActions && (
          <div data-testid="swipeable-right-actions">{renderRightActions()}</div>
        )}
      </div>
    );
  });

  MockSwipeable.displayName = 'MockSwipeable';

  return {
    Swipeable: MockSwipeable,
    GestureHandlerRootView: ({ children }: any) => children,
  };
});

describe('ConversationListItem - Archive Functionality', () => {
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
    unreadCount: { user1: 0, user2: 0 },
    archivedBy: {},
    deletedBy: {},
    mutedBy: {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSwipeableRef = null;
  });

  describe('Archive Action', () => {
    it('should render Archive button in swipe action', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={false}
        />
      );

      expect(getByText('Archive')).toBeTruthy();
    });

    it('should call onArchive with archive=true when Archive button is pressed', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={false}
        />
      );

      const archiveButton = getByText('Archive');
      fireEvent.press(archiveButton);

      expect(mockOnArchive).toHaveBeenCalledWith('conv123', true);
    });

    it('should close swipeable after archive action', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={false}
        />
      );

      const archiveButton = getByText('Archive');
      fireEvent.press(archiveButton);

      expect(mockSwipeableRef?.close).toHaveBeenCalled();
    });
  });

  describe('Unarchive Action', () => {
    it('should render Unarchive button when isArchived is true', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={true}
        />
      );

      expect(getByText('Unarchive')).toBeTruthy();
    });

    it('should call onArchive with archive=false when Unarchive button is pressed', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={true}
        />
      );

      const unarchiveButton = getByText('Unarchive');
      fireEvent.press(unarchiveButton);

      expect(mockOnArchive).toHaveBeenCalledWith('conv123', false);
    });

    it('should close swipeable after unarchive action', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={true}
        />
      );

      const unarchiveButton = getByText('Unarchive');
      fireEvent.press(unarchiveButton);

      expect(mockSwipeableRef?.close).toHaveBeenCalled();
    });
  });

  describe('No Archive Handler', () => {
    it('should not render swipe actions when onArchive is not provided', () => {
      const { queryByTestId } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
        />
      );

      expect(queryByTestId('swipeable-right-actions')).toBeFalsy();
    });
  });

  describe('Group Conversations', () => {
    const groupConversation: Conversation = {
      ...mockConversation,
      type: 'group',
      participantIds: ['user1', 'user2', 'user3'],
      groupName: 'Team Chat',
    };

    it('should support archiving group conversations', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={groupConversation}
          currentUserId="user1"
          otherParticipantName="Team Chat"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={false}
        />
      );

      const archiveButton = getByText('Archive');
      fireEvent.press(archiveButton);

      expect(mockOnArchive).toHaveBeenCalledWith('conv123', true);
    });

    it('should support unarchiving group conversations', () => {
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={groupConversation}
          currentUserId="user1"
          otherParticipantName="Team Chat"
          otherParticipantPhoto={null}
          onPress={jest.fn()}
          onArchive={mockOnArchive}
          isArchived={true}
        />
      );

      const unarchiveButton = getByText('Unarchive');
      fireEvent.press(unarchiveButton);

      expect(mockOnArchive).toHaveBeenCalledWith('conv123', false);
    });
  });

  describe('Main Item Press', () => {
    it('should still call onPress when tapping the main item', () => {
      const mockOnPress = jest.fn();
      const mockOnArchive = jest.fn();
      const { getByText } = render(
        <ConversationListItem
          conversation={mockConversation}
          currentUserId="user1"
          otherParticipantName="Jane Smith"
          otherParticipantPhoto={null}
          onPress={mockOnPress}
          onArchive={mockOnArchive}
          isArchived={false}
        />
      );

      const mainItem = getByText('Jane Smith');
      fireEvent.press(mainItem);

      expect(mockOnPress).toHaveBeenCalledWith('conv123');
    });
  });
});
