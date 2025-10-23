/**
 * Tests for UserCacheService
 *
 * @remarks
 * Tests the caching layer implementation that prevents redundant Firebase queries
 * and fixes the infinite loop issue from the unified conversation refactor.
 */

import { userCacheService } from '@/services/userCacheService';
import * as userService from '@/services/userService';
import type { User } from '@/types/user';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

// Mock the userService module
jest.mock('@/services/userService');

describe('UserCacheService', () => {
  const mockUsers: User[] = [
    {
      uid: 'user1',
      username: 'johndoe',
      displayName: 'John Doe',
      email: 'john@example.com',
      photoURL: 'https://example.com/john.jpg',
      bio: 'Test bio',
      presence: {
        state: 'online',
        lastSeen: Date.now()
      },
      settings: {
        notifications: {
          messages: true,
          mentions: true,
          reactions: true
        },
        privacy: {
          showOnlineStatus: true,
          readReceipts: true,
          typingIndicators: true
        }
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      uid: 'user2',
      username: 'janedoe',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
      photoURL: null,
      bio: '',
      presence: {
        state: 'offline',
        lastSeen: Date.now() - 3600000
      },
      settings: {
        notifications: {
          messages: true,
          mentions: true,
          reactions: false
        },
        privacy: {
          showOnlineStatus: false,
          readReceipts: true,
          typingIndicators: true
        }
      },
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the cache before each test
    userCacheService.invalidateCache();
  });

  describe('searchUsers', () => {
    it('should return empty array for empty or short queries', async () => {
      const result1 = await userCacheService.searchUsers('');
      expect(result1).toEqual([]);

      const result2 = await userCacheService.searchUsers('a');
      expect(result2).toEqual([]);

      // Should not call Firebase for invalid queries
      expect(userService.searchUsers).not.toHaveBeenCalled();
    });

    it('should fetch from Firebase on first search', async () => {
      const searchQuery = 'john';
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);

      const result = await userCacheService.searchUsers(searchQuery);

      expect(userService.searchUsers).toHaveBeenCalledWith(searchQuery);
      expect(result).toEqual(mockUsers);
    });

    it('should return cached results for repeated searches', async () => {
      const searchQuery = 'john';
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);

      // First search - should hit Firebase
      const result1 = await userCacheService.searchUsers(searchQuery);
      expect(userService.searchUsers).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockUsers);

      // Second search - should return from cache
      const result2 = await userCacheService.searchUsers(searchQuery);
      expect(userService.searchUsers).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2).toEqual(mockUsers);
    });

    it('should handle search failures gracefully', async () => {
      const searchQuery = 'error';
      (userService.searchUsers as jest.Mock).mockRejectedValueOnce(new Error('Firebase error'));

      const result = await userCacheService.searchUsers(searchQuery);

      expect(result).toEqual([]);
      expect(userService.searchUsers).toHaveBeenCalledWith(searchQuery);
    });

    it('should return stale cache on subsequent failures', async () => {
      const searchQuery = 'test';

      // First successful search
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);
      const result1 = await userCacheService.searchUsers(searchQuery);
      expect(result1).toEqual(mockUsers);

      // Invalidate cache to force refetch
      userCacheService.invalidateCache();

      // Second search fails but returns stale data
      (userService.searchUsers as jest.Mock).mockRejectedValueOnce(new Error('Firebase error'));
      const result2 = await userCacheService.searchUsers(searchQuery);

      // Should still get the cached results despite the error
      expect(result2).toEqual([]);
    });
  });

  describe('getRecentUsers', () => {
    const mockPaginatedResult = {
      users: mockUsers,
      lastDoc: null as QueryDocumentSnapshot | null,
      hasMore: false
    };

    it('should fetch recent users from Firebase on first call', async () => {
      (userService.getPaginatedUsers as jest.Mock).mockResolvedValueOnce(mockPaginatedResult);

      const result = await userCacheService.getRecentUsers(20);

      expect(userService.getPaginatedUsers).toHaveBeenCalledWith(20);
      expect(result).toEqual(mockUsers);
    });

    it('should return cached recent users on subsequent calls', async () => {
      (userService.getPaginatedUsers as jest.Mock).mockResolvedValueOnce(mockPaginatedResult);

      // First call - fetches from Firebase
      const result1 = await userCacheService.getRecentUsers(20);
      expect(userService.getPaginatedUsers).toHaveBeenCalledTimes(1);

      // Second call - returns from cache
      const result2 = await userCacheService.getRecentUsers(20);
      expect(userService.getPaginatedUsers).toHaveBeenCalledTimes(1); // Still only once
      expect(result2).toEqual(result1);
    });

    it('should respect the limit parameter', async () => {
      (userService.getPaginatedUsers as jest.Mock).mockResolvedValueOnce(mockPaginatedResult);

      await userCacheService.getRecentUsers(10);

      // Should request only 10 users
      expect(userService.getPaginatedUsers).toHaveBeenCalledWith(10);
    });

    it('should handle failures gracefully', async () => {
      (userService.getPaginatedUsers as jest.Mock).mockRejectedValueOnce(new Error('Firebase error'));

      const result = await userCacheService.getRecentUsers(20);

      expect(result).toEqual([]);
    });
  });

  describe('getPaginatedUsersCached', () => {
    const mockPaginatedResult = {
      users: mockUsers,
      lastDoc: {} as QueryDocumentSnapshot,
      hasMore: true
    };

    it('should always fetch from Firebase (no caching for pagination)', async () => {
      (userService.getPaginatedUsers as jest.Mock).mockResolvedValue(mockPaginatedResult);

      // Multiple calls should all hit Firebase
      await userCacheService.getPaginatedUsersCached(20, null);
      await userCacheService.getPaginatedUsersCached(20, null);
      await userCacheService.getPaginatedUsersCached(20, null);

      expect(userService.getPaginatedUsers).toHaveBeenCalledTimes(3);
    });

    it('should cache individual users from paginated results', async () => {
      (userService.getPaginatedUsers as jest.Mock).mockResolvedValueOnce(mockPaginatedResult);

      await userCacheService.getPaginatedUsersCached(20, null);

      // Check that users are cached
      const cachedUser = userCacheService.getCachedUser('user1');
      expect(cachedUser).toEqual(mockUsers[0]);
    });
  });

  describe('getCachedUser', () => {
    it('should return null for non-cached users', () => {
      const result = userCacheService.getCachedUser('unknown');
      expect(result).toBeNull();
    });

    it('should return cached user after search', async () => {
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);

      await userCacheService.searchUsers('john');

      const cachedUser = userCacheService.getCachedUser('user1');
      expect(cachedUser).toEqual(mockUsers[0]);
    });
  });

  describe('updateUserInCache', () => {
    it('should update user in all caches', async () => {
      // First, populate caches
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);
      (userService.getPaginatedUsers as jest.Mock).mockResolvedValueOnce({
        users: mockUsers,
        lastDoc: null,
        hasMore: false
      });

      await userCacheService.searchUsers('john');
      await userCacheService.getRecentUsers(20);

      // Update user
      const updatedUser = {
        ...mockUsers[0],
        displayName: 'John Updated'
      };

      userCacheService.updateUserInCache(updatedUser);

      // Verify update in cache
      const cachedUser = userCacheService.getCachedUser('user1');
      expect(cachedUser?.displayName).toBe('John Updated');
    });
  });

  describe('cache invalidation', () => {
    it('should clear all caches on invalidateCache', async () => {
      // Populate caches
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);
      await userCacheService.searchUsers('john');

      // Invalidate
      userCacheService.invalidateCache();

      // Should fetch again from Firebase
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);
      await userCacheService.searchUsers('john');

      expect(userService.searchUsers).toHaveBeenCalledTimes(2);
    });

    it('should invalidate specific search query', async () => {
      (userService.searchUsers as jest.Mock).mockResolvedValue(mockUsers);

      // Cache two different searches
      await userCacheService.searchUsers('john');
      await userCacheService.searchUsers('jane');

      // Invalidate only 'john'
      userCacheService.invalidateSearchQuery('john');

      // 'john' search should hit Firebase again
      await userCacheService.searchUsers('john');
      expect(userService.searchUsers).toHaveBeenCalledTimes(3);

      // 'jane' search should still be cached
      await userCacheService.searchUsers('jane');
      expect(userService.searchUsers).toHaveBeenCalledTimes(3);
    });
  });

  describe('cache timeout behavior', () => {
    it('should respect 5-minute cache timeout', async () => {
      jest.useFakeTimers();

      (userService.searchUsers as jest.Mock).mockResolvedValue(mockUsers);

      // Initial search
      await userCacheService.searchUsers('test');
      expect(userService.searchUsers).toHaveBeenCalledTimes(1);

      // Search again within 5 minutes - should use cache
      jest.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      await userCacheService.searchUsers('test');
      expect(userService.searchUsers).toHaveBeenCalledTimes(1);

      // Search after 5 minutes - should fetch again
      jest.advanceTimersByTime(2 * 60 * 1000); // 2 more minutes (total 6)
      await userCacheService.searchUsers('test');
      expect(userService.searchUsers).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });
});