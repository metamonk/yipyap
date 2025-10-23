/**
 * Performance tests for search optimization
 *
 * @remarks
 * Verifies that the UserCacheService and search optimizations
 * meet the <200ms response time target from the recovery plan.
 */

import { userCacheService } from '@/services/userCacheService';
import * as userService from '@/services/userService';
import type { User } from '@/types/user';

// Mock the userService module
jest.mock('@/services/userService');

describe('Search Performance Tests', () => {
  const generateMockUsers = (count: number): User[] => {
    return Array.from({ length: count }, (_, i) => ({
      uid: `user${i}`,
      username: `user${i}`,
      displayName: `User ${i}`,
      email: `user${i}@example.com`,
      photoURL: i % 2 === 0 ? `https://example.com/user${i}.jpg` : null,
      bio: `Bio for user ${i}`,
      presence: {
        state: i % 3 === 0 ? 'online' : 'offline' as 'online' | 'offline',
        lastSeen: Date.now() - (i * 1000)
      },
      settings: {
        notifications: {
          messages: true,
          mentions: true,
          reactions: i % 2 === 0
        },
        privacy: {
          showOnlineStatus: true,
          readReceipts: true,
          typingIndicators: true
        }
      },
      createdAt: Date.now() - (i * 86400000),
      updatedAt: Date.now() - (i * 3600000)
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userCacheService.invalidateCache();
  });

  describe('Search Response Time', () => {
    it('should return search results in less than 200ms for first search', async () => {
      const mockUsers = generateMockUsers(50);

      // Mock Firebase delay (simulate network latency)
      (userService.searchUsers as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockUsers), 150); // Simulate 150ms Firebase response
        });
      });

      const startTime = Date.now();
      const results = await userCacheService.searchUsers('user');
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
      expect(results).toHaveLength(50);
      console.log(`First search completed in ${duration}ms`);
    });

    it('should return cached results in less than 10ms', async () => {
      const mockUsers = generateMockUsers(100);

      // First search to populate cache
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(mockUsers);
      await userCacheService.searchUsers('test');

      // Measure cached search
      const startTime = Date.now();
      const results = await userCacheService.searchUsers('test');
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
      expect(results).toHaveLength(100);
      console.log(`Cached search completed in ${duration}ms`);
    });

    it('should handle multiple concurrent searches efficiently', async () => {
      const mockUsers = generateMockUsers(30);

      (userService.searchUsers as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockUsers), 100);
        });
      });

      const startTime = Date.now();

      // Launch multiple concurrent searches
      const searches = [
        userCacheService.searchUsers('john'),
        userCacheService.searchUsers('jane'),
        userCacheService.searchUsers('bob'),
        userCacheService.searchUsers('alice'),
        userCacheService.searchUsers('charlie')
      ];

      const results = await Promise.all(searches);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All searches should complete in reasonable time
      expect(duration).toBeLessThan(600); // 5 searches * 100ms + overhead
      results.forEach(result => {
        expect(result).toHaveLength(30);
      });

      console.log(`5 concurrent searches completed in ${duration}ms`);
    });
  });

  describe('Pagination Performance', () => {
    it('should paginate users efficiently', async () => {
      const mockPaginatedResult = {
        users: generateMockUsers(20),
        lastDoc: null,
        hasMore: true
      };

      (userService.getPaginatedUsers as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockPaginatedResult), 50);
        });
      });

      const startTime = Date.now();
      const result = await userCacheService.getPaginatedUsersCached(20);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
      expect(result.users).toHaveLength(20);
      console.log(`Pagination completed in ${duration}ms`);
    });

    it('should handle rapid pagination requests', async () => {
      const pages = Array.from({ length: 5 }, (_, i) => ({
        users: generateMockUsers(20),
        lastDoc: i < 4 ? {} as any : null,
        hasMore: i < 4
      }));

      let pageIndex = 0;
      (userService.getPaginatedUsers as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(pages[pageIndex++]), 30);
        });
      });

      const startTime = Date.now();

      // Simulate rapid pagination
      let lastDoc = null;
      const allUsers: User[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await userCacheService.getPaginatedUsersCached(20, lastDoc);
        allUsers.push(...result.users);
        lastDoc = result.lastDoc;
        if (!result.hasMore) break;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(250); // 5 pages * 30ms + overhead
      expect(allUsers).toHaveLength(100);
      console.log(`5 page loads completed in ${duration}ms`);
    });
  });

  describe('Cache Performance', () => {
    it('should efficiently update user in cache', async () => {
      const users = generateMockUsers(1000);

      // Populate cache with many users
      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(users);
      await userCacheService.searchUsers('user');

      const updatedUser = { ...users[500], displayName: 'Updated User 500' };

      const startTime = Date.now();
      userCacheService.updateUserInCache(updatedUser);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);

      const cachedUser = userCacheService.getCachedUser('user500');
      expect(cachedUser?.displayName).toBe('Updated User 500');
      console.log(`Cache update completed in ${duration}ms`);
    });

    it('should handle cache invalidation quickly', async () => {
      // Populate cache with multiple searches
      const mockUsers = generateMockUsers(100);
      (userService.searchUsers as jest.Mock).mockResolvedValue(mockUsers);

      await userCacheService.searchUsers('test1');
      await userCacheService.searchUsers('test2');
      await userCacheService.searchUsers('test3');

      const startTime = Date.now();
      userCacheService.invalidateCache();
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
      console.log(`Cache invalidation completed in ${duration}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not exceed reasonable memory limits with large datasets', async () => {
      const largeUserSet = generateMockUsers(5000);

      (userService.searchUsers as jest.Mock).mockResolvedValueOnce(largeUserSet);

      // Get initial memory (if available in test environment)
      const initialMemory = process.memoryUsage?.().heapUsed || 0;

      await userCacheService.searchUsers('large');

      const finalMemory = process.memoryUsage?.().heapUsed || 0;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB

      // Should not use more than 50MB for 5000 users
      expect(memoryIncrease).toBeLessThan(50);
      console.log(`Memory increase for 5000 users: ${memoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical user search workflow efficiently', async () => {
      const mockUsers = generateMockUsers(200);

      (userService.searchUsers as jest.Mock).mockImplementation((query: string) => {
        return new Promise(resolve => {
          const filtered = mockUsers.filter(u =>
            u.displayName.toLowerCase().includes(query.toLowerCase()) ||
            u.username.toLowerCase().includes(query.toLowerCase())
          );
          setTimeout(() => resolve(filtered), 80);
        });
      });

      const startTime = Date.now();

      // Simulate user typing
      await userCacheService.searchUsers('us');
      await userCacheService.searchUsers('use');
      await userCacheService.searchUsers('user');

      // User selects and searches for another
      await userCacheService.searchUsers('jo');
      await userCacheService.searchUsers('joh');
      await userCacheService.searchUsers('john');

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Should handle rapid typing with caching
      expect(totalDuration).toBeLessThan(500);
      console.log(`Complete search workflow completed in ${totalDuration}ms`);
    });

    it('should meet <200ms target for 95% of searches', async () => {
      const mockUsers = generateMockUsers(100);
      const searchTimes: number[] = [];

      (userService.searchUsers as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          // Simulate variable network latency
          const delay = Math.random() * 150 + 50; // 50-200ms
          setTimeout(() => resolve(mockUsers), delay);
        });
      });

      // Run 100 searches
      for (let i = 0; i < 100; i++) {
        // Clear cache for some searches to simulate real usage
        if (i % 10 === 0) {
          userCacheService.invalidateCache();
        }

        const query = `user${i % 20}`; // Reuse some queries for cache hits
        const start = Date.now();
        await userCacheService.searchUsers(query);
        const duration = Date.now() - start;
        searchTimes.push(duration);
      }

      // Calculate percentiles
      searchTimes.sort((a, b) => a - b);
      const p95 = searchTimes[Math.floor(searchTimes.length * 0.95)];
      const p99 = searchTimes[Math.floor(searchTimes.length * 0.99)];
      const average = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;

      console.log(`Search performance metrics (100 searches):`);
      console.log(`  Average: ${average.toFixed(2)}ms`);
      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);

      // 95th percentile should be under 200ms
      expect(p95).toBeLessThan(200);
      expect(average).toBeLessThan(150);
    });
  });
});