/**
 * Unit tests for useTypingIndicator hook
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { typingService } from '@/services/typingService';
import { getUserProfile } from '@/services/userService';
import type { User } from '@/types/user';
import type { TypingIndicator } from '@/types/models';

// Mock dependencies
jest.mock('@/services/typingService');
jest.mock('@/services/userService');

const mockTypingService = typingService as jest.Mocked<typeof typingService>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;

describe('useTypingIndicator Hook', () => {
  // Test data
  const conversationId = 'conv123';
  const currentUserId = 'user1';
  const otherUserId = 'user2';
  const thirdUserId = 'user3';

  const mockUser2: User = {
    uid: otherUserId,
    email: 'user2@test.com',
    username: 'user2',
    displayName: 'Alice',
    photoURL: null,
    presence: { status: 'online', lastSeen: new Date() },
    settings: { sendReadReceipts: true, notificationsEnabled: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser3: User = {
    uid: thirdUserId,
    email: 'user3@test.com',
    username: 'user3',
    displayName: 'Bob',
    photoURL: null,
    presence: { status: 'online', lastSeen: new Date() },
    settings: { sendReadReceipts: true, notificationsEnabled: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getUserProfile to return user data
    mockGetUserProfile.mockImplementation(async (uid: string) => {
      if (uid === otherUserId) return mockUser2;
      if (uid === thirdUserId) return mockUser3;
      return null;
    });
  });

  describe('Typing State Subscription', () => {
    it('should subscribe to correct RTDB path', () => {
      const mockUnsubscribe = jest.fn();
      mockTypingService.subscribeToTyping.mockReturnValue(mockUnsubscribe);

      renderHook(() => useTypingIndicator(conversationId, currentUserId));

      expect(mockTypingService.subscribeToTyping).toHaveBeenCalledWith(
        conversationId,
        currentUserId,
        expect.any(Function)
      );
    });

    it('should not subscribe if conversationId is undefined', () => {
      renderHook(() => useTypingIndicator(undefined, currentUserId));

      expect(mockTypingService.subscribeToTyping).not.toHaveBeenCalled();
    });

    it('should not subscribe if currentUserId is undefined', () => {
      renderHook(() => useTypingIndicator(conversationId, undefined));

      expect(mockTypingService.subscribeToTyping).not.toHaveBeenCalled();
    });
  });

  describe('Typing Users Array', () => {
    it('should return empty array initially', () => {
      const mockUnsubscribe = jest.fn();
      mockTypingService.subscribeToTyping.mockReturnValue(mockUnsubscribe);

      const { result } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      expect(result.current.typingUsers).toEqual([]);
    });

    it('should return array with typing user and display name', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      // Simulate typing state change
      const typingData: Record<string, TypingIndicator> = {
        [otherUserId]: {
          isTyping: true,
          timestamp: Date.now(),
        },
      };

      typingCallback?.(typingData);

      await waitFor(() => {
        expect(result.current.typingUsers).toHaveLength(1);
        expect(result.current.typingUsers[0]).toEqual({
          userId: otherUserId,
          displayName: 'Alice',
        });
      });
    });

    it('should handle multiple users typing simultaneously', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      // Simulate multiple users typing
      const typingData: Record<string, TypingIndicator> = {
        [otherUserId]: {
          isTyping: true,
          timestamp: Date.now(),
        },
        [thirdUserId]: {
          isTyping: true,
          timestamp: Date.now(),
        },
      };

      typingCallback?.(typingData);

      await waitFor(() => {
        expect(result.current.typingUsers).toHaveLength(2);
        expect(result.current.typingUsers).toEqual(
          expect.arrayContaining([
            { userId: otherUserId, displayName: 'Alice' },
            { userId: thirdUserId, displayName: 'Bob' },
          ])
        );
      });
    });

    it('should clear typing users when no one is typing', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      // First, simulate typing
      typingCallback?.({ [otherUserId]: { isTyping: true, timestamp: Date.now() } });

      await waitFor(() => {
        expect(result.current.typingUsers).toHaveLength(1);
      });

      // Then clear typing
      typingCallback?.({});

      await waitFor(() => {
        expect(result.current.typingUsers).toEqual([]);
      });
    });
  });

  describe('Display Name Resolution', () => {
    it('should fetch display names for typing users', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      renderHook(() => useTypingIndicator(conversationId, currentUserId));

      typingCallback?.({ [otherUserId]: { isTyping: true, timestamp: Date.now() } });

      await waitFor(() => {
        expect(mockGetUserProfile).toHaveBeenCalledWith(otherUserId);
      });
    });

    it('should use fallback display name when user not found', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      mockGetUserProfile.mockResolvedValue(null);

      const { result } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      typingCallback?.({ [otherUserId]: { isTyping: true, timestamp: Date.now() } });

      await waitFor(() => {
        expect(result.current.typingUsers[0].displayName).toBe('Someone');
      });
    });

    it('should cache display names to avoid repeated fetches', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      renderHook(() => useTypingIndicator(conversationId, currentUserId));

      // First typing event
      typingCallback?.({ [otherUserId]: { isTyping: true, timestamp: Date.now() } });

      await waitFor(() => {
        expect(mockGetUserProfile).toHaveBeenCalledTimes(1);
      });

      // Second typing event for same user
      typingCallback?.({ [otherUserId]: { isTyping: true, timestamp: Date.now() + 1000 } });

      await waitFor(() => {
        // Should still only be called once (cached)
        expect(mockGetUserProfile).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe RTDB listener on unmount', () => {
      const mockUnsubscribe = jest.fn();
      mockTypingService.subscribeToTyping.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe when conversationId changes', () => {
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();

      mockTypingService.subscribeToTyping
        .mockReturnValueOnce(mockUnsubscribe1)
        .mockReturnValueOnce(mockUnsubscribe2);

      const { rerender } = renderHook(
        ({ convId }) => useTypingIndicator(convId, currentUserId),
        { initialProps: { convId: conversationId } }
      );

      // Change conversation ID
      rerender({ convId: 'conv456' });

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockTypingService.subscribeToTyping).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors when fetching display names', async () => {
      const mockUnsubscribe = jest.fn();
      let typingCallback: ((data: Record<string, TypingIndicator>) => void) | null = null;

      mockTypingService.subscribeToTyping.mockImplementation((convId, userId, callback) => {
        typingCallback = callback;
        return mockUnsubscribe;
      });

      mockGetUserProfile.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTypingIndicator(conversationId, currentUserId));

      typingCallback?.({ [otherUserId]: { isTyping: true, timestamp: Date.now() } });

      await waitFor(() => {
        expect(result.current.typingUsers[0].displayName).toBe('Someone');
        expect(result.current.error).toBe('Failed to load typing users');
      });
    });
  });
});
