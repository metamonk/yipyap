/**
 * Tests for ConversationCreationContext
 *
 * @remarks
 * Tests the global state management for conversation creation flow
 * that replaces component-local state to prevent state chaos.
 */

import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import {
  ConversationCreationProvider,
  useConversationCreation
} from '@/contexts/ConversationCreationContext';
import type { User } from '@/types/user';

describe('ConversationCreationContext', () => {
  const mockUser1: User = {
    uid: 'user1',
    username: 'johndoe',
    displayName: 'John Doe',
    email: 'john@example.com',
    photoURL: 'https://example.com/john.jpg',
    bio: 'Test bio',
    presence: { state: 'online', lastSeen: Date.now() },
    settings: {
      notifications: { messages: true, mentions: true, reactions: true },
      privacy: { showOnlineStatus: true, readReceipts: true, typingIndicators: true }
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const mockUser2: User = {
    uid: 'user2',
    username: 'janedoe',
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    photoURL: null,
    bio: '',
    presence: { state: 'offline', lastSeen: Date.now() },
    settings: {
      notifications: { messages: true, mentions: false, reactions: false },
      privacy: { showOnlineStatus: false, readReceipts: true, typingIndicators: false }
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConversationCreationProvider>{children}</ConversationCreationProvider>
  );

  describe('Context initialization', () => {
    it('should provide initial state', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      expect(result.current.recipients).toEqual([]);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.groupName).toBe('');
      expect(result.current.messageText).toBe('');
      expect(result.current.isCreating).toBe(false);
    });

    it('should throw error when used outside provider', () => {
      // This should throw an error when trying to use the hook outside the provider
      expect(() => {
        renderHook(() => useConversationCreation());
      }).toThrow('useConversationCreation must be used within ConversationCreationProvider');
    });
  });

  describe('Recipient management', () => {
    it('should add recipients', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.addRecipient(mockUser1);
      });

      expect(result.current.recipients).toHaveLength(1);
      expect(result.current.recipients[0]).toEqual(mockUser1);
    });

    it('should prevent duplicate recipients', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.addRecipient(mockUser1);
        result.current.addRecipient(mockUser1); // Try to add same user again
      });

      expect(result.current.recipients).toHaveLength(1);
    });

    it('should enforce maximum of 10 recipients', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      // Create 11 mock users
      const manyUsers = Array.from({ length: 11 }, (_, i) => ({
        ...mockUser1,
        uid: `user${i}`,
        username: `user${i}`,
        displayName: `User ${i}`
      }));

      act(() => {
        manyUsers.forEach(user => result.current.addRecipient(user));
      });

      // Should only have 10 recipients
      expect(result.current.recipients).toHaveLength(10);
      // The 11th user should not be added
      expect(result.current.recipients.find(u => u.uid === 'user10')).toBeUndefined();
    });

    it('should remove recipients by uid', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.addRecipient(mockUser1);
        result.current.addRecipient(mockUser2);
      });

      expect(result.current.recipients).toHaveLength(2);

      act(() => {
        result.current.removeRecipient('user1');
      });

      expect(result.current.recipients).toHaveLength(1);
      expect(result.current.recipients[0].uid).toBe('user2');
    });

    it('should set recipients directly', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      const users = [mockUser1, mockUser2];

      act(() => {
        result.current.setRecipients(users);
      });

      expect(result.current.recipients).toEqual(users);
    });

    it('should handle removing non-existent recipient', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.addRecipient(mockUser1);
        result.current.removeRecipient('nonexistent');
      });

      // Should not affect existing recipients
      expect(result.current.recipients).toHaveLength(1);
      expect(result.current.recipients[0]).toEqual(mockUser1);
    });
  });

  describe('Search query management', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.setSearchQuery('john');
      });

      expect(result.current.searchQuery).toBe('john');
    });

    it('should handle empty search query', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.setSearchQuery('test');
        result.current.setSearchQuery('');
      });

      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('Group name management', () => {
    it('should update group name', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.setGroupName('Team Chat');
      });

      expect(result.current.groupName).toBe('Team Chat');
    });

    it('should handle special characters in group name', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      const specialName = 'Team @#$% Chat';
      act(() => {
        result.current.setGroupName(specialName);
      });

      expect(result.current.groupName).toBe(specialName);
    });
  });

  describe('Message text management', () => {
    it('should update message text', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      const message = 'Hello, this is the first message!';
      act(() => {
        result.current.setMessageText(message);
      });

      expect(result.current.messageText).toBe(message);
    });

    it('should handle multiline message text', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      act(() => {
        result.current.setMessageText(multilineMessage);
      });

      expect(result.current.messageText).toBe(multilineMessage);
    });
  });

  describe('Creation state management', () => {
    it('should update isCreating flag', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.setIsCreating(true);
      });

      expect(result.current.isCreating).toBe(true);

      act(() => {
        result.current.setIsCreating(false);
      });

      expect(result.current.isCreating).toBe(false);
    });
  });

  describe('Reset functionality', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      // Set various state values
      act(() => {
        result.current.addRecipient(mockUser1);
        result.current.setSearchQuery('test search');
        result.current.setGroupName('Test Group');
        result.current.setMessageText('Test message');
        result.current.setIsCreating(true);
      });

      // Verify state is set
      expect(result.current.recipients).toHaveLength(1);
      expect(result.current.searchQuery).toBe('test search');
      expect(result.current.groupName).toBe('Test Group');
      expect(result.current.messageText).toBe('Test message');
      expect(result.current.isCreating).toBe(true);

      // Reset state
      act(() => {
        result.current.resetState();
      });

      // Verify all state is reset
      expect(result.current.recipients).toEqual([]);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.groupName).toBe('');
      expect(result.current.messageText).toBe('');
      expect(result.current.isCreating).toBe(false);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rapid state updates', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        // Simulate rapid user interactions
        result.current.setSearchQuery('j');
        result.current.setSearchQuery('jo');
        result.current.setSearchQuery('joh');
        result.current.setSearchQuery('john');
        result.current.addRecipient(mockUser1);
        result.current.setSearchQuery('');
        result.current.setSearchQuery('jane');
        result.current.addRecipient(mockUser2);
        result.current.setGroupName('Team');
        result.current.setMessageText('Hello');
      });

      expect(result.current.searchQuery).toBe('jane');
      expect(result.current.recipients).toHaveLength(2);
      expect(result.current.groupName).toBe('Team');
      expect(result.current.messageText).toBe('Hello');
    });

    it('should maintain state consistency during creation', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.addRecipient(mockUser1);
        result.current.addRecipient(mockUser2);
        result.current.setGroupName('Project Team');
        result.current.setMessageText('Welcome to the group!');
        result.current.setIsCreating(true);
      });

      // State should remain consistent during creation
      expect(result.current.recipients).toHaveLength(2);
      expect(result.current.isCreating).toBe(true);

      // Should still be able to read state during creation
      expect(result.current.groupName).toBe('Project Team');
      expect(result.current.messageText).toBe('Welcome to the group!');
    });

    it('should handle state updates after reset', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.addRecipient(mockUser1);
        result.current.resetState();
        result.current.addRecipient(mockUser2);
      });

      expect(result.current.recipients).toHaveLength(1);
      expect(result.current.recipients[0].uid).toBe('user2');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string values', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      act(() => {
        result.current.setSearchQuery('');
        result.current.setGroupName('');
        result.current.setMessageText('');
      });

      expect(result.current.searchQuery).toBe('');
      expect(result.current.groupName).toBe('');
      expect(result.current.messageText).toBe('');
    });

    it('should handle very long strings', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      const longString = 'a'.repeat(10000);

      act(() => {
        result.current.setSearchQuery(longString);
        result.current.setGroupName(longString);
        result.current.setMessageText(longString);
      });

      expect(result.current.searchQuery).toBe(longString);
      expect(result.current.groupName).toBe(longString);
      expect(result.current.messageText).toBe(longString);
    });

    it('should handle recipients with same display name', () => {
      const { result } = renderHook(() => useConversationCreation(), { wrapper });

      const user1WithSameName = { ...mockUser1, displayName: 'John' };
      const user2WithSameName = { ...mockUser2, displayName: 'John' };

      act(() => {
        result.current.addRecipient(user1WithSameName);
        result.current.addRecipient(user2WithSameName);
      });

      // Both should be added as they have different UIDs
      expect(result.current.recipients).toHaveLength(2);
    });
  });
});