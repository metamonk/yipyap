/**
 * Unified Conversation Creation Integration Tests
 *
 * @remarks
 * Integration tests for the unified conversation creation flow,
 * testing both direct and group conversation scenarios.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import NewConversationScreen from '@/app/(tabs)/conversations/new';
import * as userService from '@/services/userService';
import * as conversationService from '@/services/conversationService';
import { useAuth } from '@/hooks/useAuth';

// Mock the dependencies
jest.mock('@/services/userService');
jest.mock('@/services/conversationService');
jest.mock('@/hooks/useAuth');
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

// Mock user data
const mockCurrentUser = {
  uid: 'current-user',
  email: 'current@example.com',
  displayName: 'Current User',
};

const mockSearchResults = [
  {
    uid: 'user1',
    email: 'user1@example.com',
    username: 'user1',
    displayName: 'User One',
    photoURL: null,
    bio: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnline: true,
    lastSeen: new Date(),
  },
  {
    uid: 'user2',
    email: 'user2@example.com',
    username: 'user2',
    displayName: 'User Two',
    photoURL: null,
    bio: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnline: false,
    lastSeen: new Date(),
  },
  {
    uid: 'user3',
    email: 'user3@example.com',
    username: 'user3',
    displayName: 'User Three',
    photoURL: null,
    bio: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnline: true,
    lastSeen: new Date(),
  },
];

describe('Unified Conversation Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockCurrentUser,
    });
    (userService.searchUsers as jest.Mock).mockResolvedValue(mockSearchResults);
    (conversationService.createConversationWithFirstMessage as jest.Mock).mockResolvedValue({
      conversationId: 'new-conversation-id',
      messageId: 'new-message-id',
    });
  });

  const renderScreen = () => {
    return render(
      <NavigationContainer>
        <NewConversationScreen />
      </NavigationContainer>
    );
  };

  describe('Direct Message Creation', () => {
    it('creates a direct message with one recipient', async () => {
      const { getByTestId, getByText } = renderScreen();

      // Search for a user
      const searchInput = getByTestId('recipient-field-input');
      fireEvent.changeText(searchInput, 'user');

      // Wait for search results
      await waitFor(() => {
        expect(userService.searchUsers).toHaveBeenCalledWith('user');
      });

      // Select a user from dropdown
      await waitFor(() => {
        const userItem = getByTestId('search-dropdown-item-user1');
        fireEvent.press(userItem);
      });

      // Verify recipient was added
      expect(getByText('User One')).toBeTruthy();

      // Group name input should NOT be visible for direct message
      const groupNameInput = getByTestId('group-name-input');
      expect(groupNameInput).toHaveStyle({ height: 0 });

      // Type first message
      const messageInput = getByTestId('message-input');
      fireEvent.changeText(messageInput, 'Hello there!');

      // Create conversation
      const createButton = getByText('Create');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(conversationService.createConversationWithFirstMessage).toHaveBeenCalledWith({
          type: 'direct',
          participantIds: ['current-user', 'user1'],
          messageText: 'Hello there!',
          senderId: 'current-user',
        });
      });
    });

    it('shows error when trying to create without recipients', async () => {
      const { getByTestId, getByText } = renderScreen();

      // Type message without adding recipients
      const messageInput = getByTestId('message-input');
      fireEvent.changeText(messageInput, 'Hello there!');

      // Try to create conversation
      const createButton = getByText('Create');
      fireEvent.press(createButton);

      // Should show error
      await waitFor(() => {
        expect(getByText('Please add at least one recipient')).toBeTruthy();
      });

      expect(conversationService.createConversationWithFirstMessage).not.toHaveBeenCalled();
    });
  });

  describe('Group Conversation Creation', () => {
    it('creates a group conversation with multiple recipients', async () => {
      const { getByTestId, getByText } = renderScreen();

      // Add first recipient
      const searchInput = getByTestId('recipient-field-input');
      fireEvent.changeText(searchInput, 'user');

      await waitFor(() => {
        const userItem = getByTestId('search-dropdown-item-user1');
        fireEvent.press(userItem);
      });

      // Add second recipient
      fireEvent.changeText(searchInput, 'user');

      await waitFor(() => {
        const userItem = getByTestId('search-dropdown-item-user2');
        fireEvent.press(userItem);
      });

      // Verify both recipients were added
      expect(getByText('User One')).toBeTruthy();
      expect(getByText('User Two')).toBeTruthy();

      // Group name input SHOULD be visible for group conversation
      await waitFor(() => {
        const groupNameInput = getByTestId('group-name-input');
        expect(groupNameInput).not.toHaveStyle({ height: 0 });
      });

      // Enter group name
      const groupNameInput = getByTestId('group-name-input');
      fireEvent.changeText(groupNameInput, 'Test Group');

      // Type first message
      const messageInput = getByTestId('message-input');
      fireEvent.changeText(messageInput, 'Hello everyone!');

      // Create conversation
      const createButton = getByText('Create');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(conversationService.createConversationWithFirstMessage).toHaveBeenCalledWith({
          type: 'group',
          participantIds: ['current-user', 'user1', 'user2'],
          messageText: 'Hello everyone!',
          senderId: 'current-user',
          groupName: 'Test Group',
        });
      });
    });

    it('shows error when group name is missing', async () => {
      const { getByTestId, getByText } = renderScreen();

      // Add two recipients to trigger group mode
      const searchInput = getByTestId('recipient-field-input');

      fireEvent.changeText(searchInput, 'user');
      await waitFor(() => {
        fireEvent.press(getByTestId('search-dropdown-item-user1'));
      });

      fireEvent.changeText(searchInput, 'user');
      await waitFor(() => {
        fireEvent.press(getByTestId('search-dropdown-item-user2'));
      });

      // Type message but don't enter group name
      const messageInput = getByTestId('message-input');
      fireEvent.changeText(messageInput, 'Hello everyone!');

      // Try to create conversation
      const createButton = getByText('Create');
      fireEvent.press(createButton);

      // Should show error
      await waitFor(() => {
        expect(getByText('Please enter a group name')).toBeTruthy();
      });

      expect(conversationService.createConversationWithFirstMessage).not.toHaveBeenCalled();
    });

    it('respects maximum recipient limit', async () => {
      const { getByTestId, getByText, queryByText } = renderScreen();

      // Add 10 recipients (maximum)
      for (let i = 0; i < 10; i++) {
        const searchInput = getByTestId('recipient-field-input');
        fireEvent.changeText(searchInput, 'user');

        await waitFor(() => {
          const userItem = getByTestId(`search-dropdown-item-user${(i % 3) + 1}`);
          fireEvent.press(userItem);
        });
      }

      // Should show maximum recipients message
      expect(getByText('Maximum 10 recipients')).toBeTruthy();

      // Search input should be disabled
      expect(queryByText('recipient-field-input')).toBeFalsy();
    });
  });

  describe('Contact Picker Integration', () => {
    it('opens contact picker and adds multiple users', async () => {
      const { getByTestId, getByText } = renderScreen();

      // Open contact picker
      const addButton = getByTestId('recipient-field-add-button');
      fireEvent.press(addButton);

      // Modal should be visible
      await waitFor(() => {
        expect(getByTestId('contact-picker')).toBeTruthy();
      });

      // Select multiple users in the modal
      const user1Checkbox = getByTestId('contact-picker-user-user1');
      const user2Checkbox = getByTestId('contact-picker-user-user2');

      fireEvent.press(user1Checkbox);
      fireEvent.press(user2Checkbox);

      // Confirm selection
      const doneButton = getByTestId('contact-picker-done');
      fireEvent.press(doneButton);

      // Verify recipients were added
      await waitFor(() => {
        expect(getByText('User One')).toBeTruthy();
        expect(getByText('User Two')).toBeTruthy();
      });
    });
  });

  describe('User Experience', () => {
    it('removes recipient when chip is deleted', async () => {
      const { getByTestId, getByText, queryByText } = renderScreen();

      // Add a recipient
      const searchInput = getByTestId('recipient-field-input');
      fireEvent.changeText(searchInput, 'user');

      await waitFor(() => {
        fireEvent.press(getByTestId('search-dropdown-item-user1'));
      });

      expect(getByText('User One')).toBeTruthy();

      // Remove the recipient
      const removeButton = getByTestId('recipient-field-chip-0-remove');
      fireEvent.press(removeButton);

      // Recipient should be removed
      await waitFor(() => {
        expect(queryByText('User One')).toBeFalsy();
      });
    });

    it('clears search after selecting a user', async () => {
      const { getByTestId } = renderScreen();

      const searchInput = getByTestId('recipient-field-input');
      fireEvent.changeText(searchInput, 'user');

      await waitFor(() => {
        fireEvent.press(getByTestId('search-dropdown-item-user1'));
      });

      // Search should be cleared
      expect(searchInput.props.value).toBe('');
    });

    it('shows appropriate help text based on recipients', async () => {
      const { getByTestId, getByText } = renderScreen();

      // No recipients
      expect(getByText('Add recipients above, then type your first message')).toBeTruthy();

      // Add one recipient (direct message)
      const searchInput = getByTestId('recipient-field-input');
      fireEvent.changeText(searchInput, 'user');

      await waitFor(() => {
        fireEvent.press(getByTestId('search-dropdown-item-user1'));
      });

      expect(getByText('Starting chat with User One')).toBeTruthy();

      // Add second recipient (group)
      fireEvent.changeText(searchInput, 'user');

      await waitFor(() => {
        fireEvent.press(getByTestId('search-dropdown-item-user2'));
      });

      expect(getByText('Starting group chat with 2 people')).toBeTruthy();
    });
  });
});