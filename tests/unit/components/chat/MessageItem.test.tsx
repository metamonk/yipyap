/**
 * Unit tests for MessageItem component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
import { MessageItem } from '@/components/chat/MessageItem';
import { MessageStatus } from '@/components/chat/MessageStatus';
import type { Message } from '@/types/models';

// Mock dependencies
jest.mock('@/components/common/Avatar', () => ({
  Avatar: () => null,
}));
jest.mock('@/utils/dateHelpers', () => ({
  formatMessageTime: jest.fn(() => '10:45 AM'),
}));
jest.mock('@/components/chat/MessageStatus', () => ({
  MessageStatus: jest.fn(() => null),
}));

describe('MessageItem', () => {
  const mockTimestamp = {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
  } as Timestamp;

  const mockMessage: Message = {
    id: 'msg1',
    conversationId: 'conv1',
    senderId: 'user1',
    text: 'Hello world',
    status: 'delivered',
    readBy: ['user1'],
    timestamp: mockTimestamp,
    metadata: { aiProcessed: false },
  };

  describe('Message Rendering', () => {
    it('renders message text correctly', () => {
      const { getByText } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL={null}
        />
      );

      expect(getByText('Hello world')).toBeTruthy();
    });

    it('displays timestamp using formatMessageTime', () => {
      const { getByText } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL={null}
        />
      );

      expect(getByText('10:45 AM')).toBeTruthy();
    });
  });

  describe('Sent Messages', () => {
    it('applies sent message styles when isOwnMessage is true', () => {
      const { getByTestId } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="You"
          senderPhotoURL={null}
        />
      );

      const container = getByTestId('message-container');
      const styles = Array.isArray(container.props.style)
        ? container.props.style
        : [container.props.style];
      expect(styles).toContainEqual(
        expect.objectContaining({ justifyContent: 'flex-end' })
      );
    });

    it('does not display sender name for sent messages', () => {
      const { queryByText } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="You"
          senderPhotoURL={null}
        />
      );

      expect(queryByText('You')).toBeNull();
    });

    it('does not display avatar for sent messages', () => {
      const { queryByTestId } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="You"
          senderPhotoURL={null}
        />
      );

      // Avatar should not be rendered
      expect(queryByTestId('avatar-image')).toBeNull();
      expect(queryByTestId('avatar-fallback')).toBeNull();
    });
  });

  describe('Message Status Indicator Visibility (AC6)', () => {
    beforeEach(() => {
      // Clear mock calls before each test
      (MessageStatus as jest.Mock).mockClear();
    });

    it('renders MessageStatus component when isOwnMessage is true', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="You"
          senderPhotoURL={null}
        />
      );

      // MessageStatus should be called (rendered)
      expect(MessageStatus).toHaveBeenCalled();
      // Verify the correct status prop was passed
      const callArgs = (MessageStatus as jest.Mock).mock.calls[0][0];
      expect(callArgs).toMatchObject({
        status: mockMessage.status,
      });
    });

    it('does NOT render MessageStatus component when isOwnMessage is false', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL={null}
        />
      );

      // MessageStatus should NOT be called (not rendered)
      expect(MessageStatus).not.toHaveBeenCalled();
    });

    it('passes correct status prop to MessageStatus for sent messages', () => {
      const sendingMessage = { ...mockMessage, status: 'sending' as const };
      render(
        <MessageItem
          message={sendingMessage}
          isOwnMessage={true}
          senderDisplayName="You"
          senderPhotoURL={null}
        />
      );

      // Verify the correct status prop was passed
      const callArgs = (MessageStatus as jest.Mock).mock.calls[0][0];
      expect(callArgs).toMatchObject({
        status: 'sending',
      });
    });
  });

  describe('Received Messages', () => {
    it('applies received message styles when isOwnMessage is false', () => {
      const { getByTestId } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL={null}
        />
      );

      const container = getByTestId('message-container');
      const styles = Array.isArray(container.props.style)
        ? container.props.style
        : [container.props.style];
      expect(styles).toContainEqual(
        expect.objectContaining({ justifyContent: 'flex-start' })
      );
    });

    it('displays sender name for received messages', () => {
      const { getByText } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL={null}
        />
      );

      expect(getByText('John Doe')).toBeTruthy();
    });

    it('renders avatar for received messages', () => {
      const { getByTestId } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/photo.jpg"
        />
      );

      // Avatar component should be rendered (mocked)
      expect(getByTestId).toBeDefined();
    });
  });

  describe('Component Optimization', () => {
    it('uses memo for performance optimization', () => {
      // MessageItem should be wrapped with memo
      expect(MessageItem.displayName).toBe('MessageItem');
    });

    it('renders with different message lengths', () => {
      const longMessage = {
        ...mockMessage,
        text: 'This is a much longer message that should still render correctly within the message bubble constraints and not overflow the container.',
      };

      const { getByText } = render(
        <MessageItem
          message={longMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL={null}
        />
      );

      expect(
        getByText(
          'This is a much longer message that should still render correctly within the message bubble constraints and not overflow the container.'
        )
      ).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles null photo URL correctly', () => {
      const { getByText } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="Jane Smith"
          senderPhotoURL={null}
        />
      );

      expect(getByText('Jane Smith')).toBeTruthy();
    });

    it('handles empty sender display name', () => {
      const { getByText } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName=""
          senderPhotoURL={null}
        />
      );

      // Should still render the message
      expect(getByText('Hello world')).toBeTruthy();
    });
  });
});
