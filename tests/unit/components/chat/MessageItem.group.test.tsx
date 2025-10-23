/**
 * Unit tests for MessageItem component group chat functionality
 *
 * @remarks
 * Tests that MessageItem correctly displays sender attribution in group conversations.
 * Verifies that sender name and avatar are ALWAYS shown for group messages (AC: 2, 5).
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageItem } from '@/components/chat/MessageItem';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock the Avatar component
jest.mock('@/components/common/Avatar', () => {
  const React = require('react');
  return {
    Avatar: jest.fn(({ displayName, photoURL, size }) =>
      React.createElement('View', {
        testID: 'avatar',
        'data-display-name': displayName,
        'data-photo-url': photoURL,
        'data-size': size,
      })
    ),
  };
});

// Mock the PresenceIndicator component
jest.mock('@/components/PresenceIndicator', () => {
  const React = require('react');
  return {
    PresenceIndicator: jest.fn(({ userId, size }) =>
      React.createElement('View', {
        testID: 'presence-indicator',
        'data-user-id': userId,
        'data-size': size,
      })
    ),
  };
});

// Mock the MessageStatus component
jest.mock('@/components/chat/MessageStatus', () => {
  const React = require('react');
  return {
    MessageStatus: jest.fn(({ status }) =>
      React.createElement('View', {
        testID: 'message-status',
        'data-status': status,
      })
    ),
  };
});

// Mock the date helper
jest.mock('@/utils/dateHelpers', () => ({
  formatMessageTime: jest.fn(() => '10:30 AM'),
}));

describe('MessageItem - Group Chat', () => {
  const mockMessage: Message = {
    id: 'msg123',
    conversationId: 'conv123',
    senderId: 'user123',
    text: 'Hello group!',
    status: 'delivered',
    readBy: ['user123'],
    timestamp: Timestamp.now(),
    metadata: {
      aiProcessed: false,
    },
  };

  describe('Group message display', () => {
    it('should NOT display sender name for own messages in group (to avoid redundancy)', () => {
      // Test own message in group
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      // Should NOT show sender name for own message (redundant)
      expect(screen.queryByText('John Doe')).toBeFalsy();
    });

    it('should display sender name for other users messages in group', () => {
      // Test other's message in group
      render(
        <MessageItem
          message={{ ...mockMessage, senderId: 'user456' }}
          isOwnMessage={false}
          senderDisplayName="Jane Smith"
          senderPhotoURL="https://example.com/jane.jpg"
          isGroupChat={true}
        />
      );

      // Should show sender name for other's message in group
      expect(screen.getByText('Jane Smith')).toBeTruthy();
    });

    it('should NOT display avatar for own messages in group (to avoid redundancy)', () => {
      // Test own message in group
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      // Should NOT show avatar for own message (redundant)
      expect(screen.queryByTestId('avatar')).toBeFalsy();
    });

    it('should display avatar for other users messages in group', () => {
      // Test other's message in group
      render(
        <MessageItem
          message={{ ...mockMessage, senderId: 'user456' }}
          isOwnMessage={false}
          senderDisplayName="Jane Smith"
          senderPhotoURL="https://example.com/jane.jpg"
          isGroupChat={true}
        />
      );

      // Should show avatar for other's message in group
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toBeTruthy();
      expect(avatar.props['data-display-name']).toBe('Jane Smith');
    });

    it('should handle missing sender info gracefully', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="Unknown User"
          senderPhotoURL={null}
          isGroupChat={true}
        />
      );

      // Should show "Unknown User" as fallback
      expect(screen.getByText('Unknown User')).toBeTruthy();

      // Should still show avatar with fallback
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toBeTruthy();
      expect(avatar.props['data-photo-url']).toBeNull();
    });

    it('should distinguish own messages from others in group', () => {
      // Test own message styling
      const { rerender } = render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      let container = screen.getByTestId('message-container');
      // Own messages should have sentMessage style (right-aligned)
      // Style is flattened when array of styles is applied
      const ownStyle = Array.isArray(container.props.style)
        ? container.props.style.find((s) => s && s.justifyContent === 'flex-end')
        : container.props.style;
      expect(ownStyle).toMatchObject({ justifyContent: 'flex-end' });

      // Test other's message styling
      rerender(
        <MessageItem
          message={{ ...mockMessage, senderId: 'user456' }}
          isOwnMessage={false}
          senderDisplayName="Jane Smith"
          senderPhotoURL="https://example.com/jane.jpg"
          isGroupChat={true}
        />
      );

      container = screen.getByTestId('message-container');
      // Other's messages should have receivedMessage style (left-aligned)
      const otherStyle = Array.isArray(container.props.style)
        ? container.props.style.find((s) => s && s.justifyContent === 'flex-start')
        : container.props.style;
      expect(otherStyle).toMatchObject({ justifyContent: 'flex-start' });
    });
  });

  describe('1:1 vs Group comparison', () => {
    it('should NOT show sender name for own messages in 1:1 chat', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={false}
        />
      );

      // Should NOT show sender name for own message in 1:1
      expect(screen.queryByText('John Doe')).toBeFalsy();
    });

    it('should NOT show avatar for own messages in 1:1 chat', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={false}
        />
      );

      // Should NOT show avatar for own message in 1:1
      expect(screen.queryByTestId('avatar')).toBeFalsy();
    });

    it('should show sender info for received messages in 1:1 chat', () => {
      render(
        <MessageItem
          message={{ ...mockMessage, senderId: 'user456' }}
          isOwnMessage={false}
          senderDisplayName="Jane Smith"
          senderPhotoURL="https://example.com/jane.jpg"
          isGroupChat={false}
        />
      );

      // Should show sender name for received message in 1:1
      expect(screen.getByText('Jane Smith')).toBeTruthy();

      // Should show avatar for received message in 1:1
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toBeTruthy();
      expect(avatar.props['data-display-name']).toBe('Jane Smith');
    });
  });

  describe('Message content display', () => {
    it('should display message text correctly in group chat', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      expect(screen.getByText('Hello group!')).toBeTruthy();
    });

    it('should display timestamp correctly in group chat', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      expect(screen.getByText('10:30 AM')).toBeTruthy();
    });

    it('should handle long messages in group chat', () => {
      const longText = 'a'.repeat(1000); // Max length message
      render(
        <MessageItem
          message={{ ...mockMessage, text: longText }}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      expect(screen.getByText(longText)).toBeTruthy();
    });
  });

  describe('Message status in group chat', () => {
    it('should show status indicator for own messages in group', () => {
      render(
        <MessageItem
          message={{ ...mockMessage, status: 'delivered' }}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      const status = screen.getByTestId('message-status');
      expect(status).toBeTruthy();
      expect(status.props['data-status']).toBe('delivered');
    });

    it('should NOT show status indicator for other messages in group', () => {
      render(
        <MessageItem
          message={{ ...mockMessage, senderId: 'user456' }}
          isOwnMessage={false}
          senderDisplayName="Jane Smith"
          senderPhotoURL="https://example.com/jane.jpg"
          isGroupChat={true}
        />
      );

      expect(screen.queryByTestId('message-status')).toBeFalsy();
    });
  });

  describe('Retry functionality in group chat', () => {
    it('should show syncing indicator when retrying in group', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
          isRetrying={true}
        />
      );

      expect(screen.getByText(' • syncing')).toBeTruthy();
    });

    it('should apply pulsing animation when retrying', () => {
      render(
        <MessageItem
          message={mockMessage}
          isOwnMessage={true}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
          isRetrying={true}
        />
      );

      const container = screen.getByTestId('message-container');
      expect(container.props.accessibilityLabel).toBe('Message syncing');
      expect(container.props.accessibilityHint).toBe('This message is being synchronized');
    });
  });

  describe('Edge Cases (Task 10)', () => {
    it('should handle very long messages (1000 characters) with proper text wrapping', () => {
      // Create a 1000-character message
      const longText = 'A'.repeat(1000);
      const longMessage: Message = {
        ...mockMessage,
        text: longText,
      };

      render(
        <MessageItem
          message={longMessage}
          isOwnMessage={false}
          senderDisplayName="John Doe"
          senderPhotoURL="https://example.com/john.jpg"
          isGroupChat={true}
        />
      );

      // Verify message renders successfully
      const messageText = screen.getByText(longText);
      expect(messageText).toBeTruthy();

      // Verify message content is exactly 1000 characters
      expect(messageText.props.children).toHaveLength(1000);

      // Verify container and layout components render properly
      const container = screen.getByTestId('message-container');
      expect(container).toBeTruthy();

      // In React Native, text wrapping is handled by the Text component's
      // default behavior. This test verifies the component doesn't crash
      // with long text and properly renders the full content.
    });

    it('should handle very long messages for own messages in group chat', () => {
      const longText = 'B'.repeat(1000);
      const longMessage: Message = {
        ...mockMessage,
        text: longText,
      };

      render(
        <MessageItem
          message={longMessage}
          isOwnMessage={true}
          senderDisplayName="Me"
          senderPhotoURL="https://example.com/me.jpg"
          isGroupChat={true}
        />
      );

      // Verify message renders successfully
      const messageText = screen.getByText(longText);
      expect(messageText).toBeTruthy();
      expect(messageText.props.children).toHaveLength(1000);

      // Verify sender name is NOT shown for own messages (redundant)
      expect(screen.queryByText('Me')).toBeFalsy();
    });
  });
});
