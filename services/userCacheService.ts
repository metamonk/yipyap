/**
 * UserCacheService
 *
 * @remarks
 * Provides intelligent caching for user queries to prevent redundant Firebase calls.
 * This service fixes the infinite loop issue by wrapping searchUsers and getPaginatedUsers
 * with a 5-minute TTL cache.
 */

import { User } from '@/types/user';
import { searchUsers as firebaseSearchUsers, getPaginatedUsers } from './userService';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

interface CachedSearchResult {
  users: User[];
  timestamp: number;
  query: string;
}

interface PaginatedUsersResult {
  users: User[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

class UserCacheService {
  private userCache: Map<string, User> = new Map();
  private searchCache: Map<string, CachedSearchResult> = new Map();
  private recentUsers: User[] = [];
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private lastRecentFetch: number = 0;

  /**
   * Search users with caching to prevent redundant queries
   * @param query - Search query (minimum 2 characters)
   * @returns Array of users matching the query
   */
  async searchUsers(query: string): Promise<User[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const cacheKey = query.toLowerCase().trim();
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.users;
    }

    try {
      const results = await firebaseSearchUsers(query);

      // Update caches
      results.forEach(user => this.userCache.set(user.uid, user));
      this.searchCache.set(cacheKey, {
        users: results,
        timestamp: Date.now(),
        query: cacheKey
      });

      return results;
    } catch (error) {
      console.error('Search failed, returning cached results:', error);
      return cached?.users || [];
    }
  }

  /**
   * Get recent users with caching
   * @param limit - Maximum number of users to return
   * @returns Array of recent users
   */
  async getRecentUsers(limit: number = 20): Promise<User[]> {
    if (
      this.recentUsers.length > 0 &&
      Date.now() - this.lastRecentFetch < this.cacheTimeout
    ) {
      return this.recentUsers.slice(0, limit);
    }

    try {
      const result = await getPaginatedUsers(limit);
      this.recentUsers = result.users;
      this.lastRecentFetch = Date.now();

      // Update user cache
      result.users.forEach(user => this.userCache.set(user.uid, user));

      return this.recentUsers;
    } catch (error) {
      console.error('Failed to fetch recent users:', error);
      return this.recentUsers.slice(0, limit);
    }
  }

  /**
   * Get paginated users with caching
   * @param pageSize - Number of users per page
   * @param lastDoc - Last document for pagination
   * @returns Paginated result with users, lastDoc, and hasMore flag
   */
  async getPaginatedUsersCached(
    pageSize: number = 20,
    lastDoc: QueryDocumentSnapshot | null = null
  ): Promise<PaginatedUsersResult> {
    // For pagination, we don't cache as it depends on the lastDoc
    // But we do cache individual users
    const result = await getPaginatedUsers(pageSize, lastDoc);

    // Update user cache
    result.users.forEach(user => this.userCache.set(user.uid, user));

    return result;
  }

  /**
   * Get a cached user by UID
   * @param uid - User UID
   * @returns User object or null if not in cache
   */
  getCachedUser(uid: string): User | null {
    return this.userCache.get(uid) || null;
  }

  /**
   * Invalidate all caches
   */
  invalidateCache(): void {
    this.userCache.clear(); // Clear user cache to prevent cross-session contamination
    this.searchCache.clear();
    this.recentUsers = [];
    this.lastRecentFetch = 0;
  }

  /**
   * Partial cache invalidation for specific queries
   * @param query - Query to invalidate
   */
  invalidateSearchQuery(query: string): void {
    const cacheKey = query.toLowerCase().trim();
    this.searchCache.delete(cacheKey);
  }

  /**
   * Update a single user in the cache
   * @param user - User to update
   */
  updateUserInCache(user: User): void {
    this.userCache.set(user.uid, user);

    // Update in search results
    this.searchCache.forEach((result) => {
      const index = result.users.findIndex(u => u.uid === user.uid);
      if (index !== -1) {
        result.users[index] = user;
      }
    });

    // Update in recent users
    const recentIndex = this.recentUsers.findIndex(u => u.uid === user.uid);
    if (recentIndex !== -1) {
      this.recentUsers[recentIndex] = user;
    }
  }
}

export const userCacheService = new UserCacheService();