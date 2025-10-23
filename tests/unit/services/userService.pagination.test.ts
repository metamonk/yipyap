/**
 * Unit tests for user pagination functions in userService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { User } from '@/types/user';
import { getPaginatedUsers } from '@/services/userService';
import { getDocs } from 'firebase/firestore';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  startAfter: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}));

describe('userService - Pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPaginatedUsers', () => {
    it('should return users with pagination metadata', async () => {

      const mockUsers: User[] = [
        { uid: 'user1', username: 'alice', displayName: 'Alice Anderson', email: 'alice@test.com' },
        { uid: 'user2', username: 'bob', displayName: 'Bob Brown', email: 'bob@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await getPaginatedUsers(20);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('lastDoc');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.users)).toBe(true);
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should respect page size limit', async () => {
      const { getPaginatedUsers } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      const pageSize = 3;
      // Create 4 users (pageSize + 1 to simulate more pages)
      const mockUsers: User[] = [
        { uid: 'user1', username: 'alice', displayName: 'Alice', email: 'alice@test.com' },
        { uid: 'user2', username: 'bob', displayName: 'Bob', email: 'bob@test.com' },
        { uid: 'user3', username: 'charlie', displayName: 'Charlie', email: 'charlie@test.com' },
        { uid: 'user4', username: 'david', displayName: 'David', email: 'david@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await getPaginatedUsers(pageSize);

      expect(result.users.length).toBe(pageSize); // Should trim to pageSize
    });

    it('should indicate hasMore when results exceed page size', async () => {
      const { getPaginatedUsers } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      const pageSize = 2;
      // Return 3 users (pageSize + 1)
      const mockUsers: User[] = [
        { uid: 'user1', username: 'alice', displayName: 'Alice', email: 'alice@test.com' },
        { uid: 'user2', username: 'bob', displayName: 'Bob', email: 'bob@test.com' },
        { uid: 'user3', username: 'charlie', displayName: 'Charlie', email: 'charlie@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await getPaginatedUsers(pageSize);

      expect(result.hasMore).toBe(true);
      expect(result.users.length).toBe(pageSize); // Extra user trimmed
    });

    it('should handle empty results', async () => {
      const { getPaginatedUsers } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => {
          // Empty - no docs to iterate
        },
        docs: [],
        size: 0,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await getPaginatedUsers(20);

      expect(result.users).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeNull();
    });

    it('should handle pagination with lastDoc cursor', async () => {
      const { getPaginatedUsers } = await import('@/services/userService');
      const { getDocs, startAfter } = await import('firebase/firestore');

       
      const mockLastDoc = { id: 'user1' } as any;

      const mockUsers: User[] = [
        { uid: 'user2', username: 'bob', displayName: 'Bob', email: 'bob@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      await getPaginatedUsers(20, mockLastDoc);

      expect(startAfter).toHaveBeenCalledWith(mockLastDoc);
    });
  });

  describe('searchUsersPaginated', () => {
    it('should return empty results for empty query', async () => {
      const { searchUsersPaginated } = await import('@/services/userService');

      const result = await searchUsersPaginated('', 20);

      expect(result.users).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it('should perform case-insensitive search', async () => {
      const { searchUsersPaginated } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      const mockUsers: User[] = [
        { uid: 'user1', username: 'alice', displayName: 'Alice Anderson', email: 'alice@test.com' },
        { uid: 'user2', username: 'bob', displayName: 'Bob Brown', email: 'bob@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await searchUsersPaginated('alice', 20);

      expect(result.users.length).toBe(1);
      expect(result.users[0].displayName).toBe('Alice Anderson');
    });

    it('should search both username and displayName fields', async () => {
      const { searchUsersPaginated } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      const mockUsers: User[] = [
        { uid: 'user1', username: 'alice', displayName: 'Alice Anderson', email: 'alice@test.com' },
        { uid: 'user2', username: 'bob', displayName: 'Bob Brown', email: 'bob@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      // Search by username
      const resultUsername = await searchUsersPaginated('bob', 20);
      expect(resultUsername.users.length).toBe(1);
      expect(resultUsername.users[0].username).toBe('bob');

      // Reset mock
      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      // Search by displayName
      const resultDisplayName = await searchUsersPaginated('Brown', 20);
      expect(resultDisplayName.users.length).toBe(1);
      expect(resultDisplayName.users[0].displayName).toBe('Bob Brown');
    });

    it('should respect pagination with search results', async () => {
      const { searchUsersPaginated } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      const pageSize = 2;
      const mockUsers: User[] = [
        { uid: 'user1', username: 'alice', displayName: 'Alice', email: 'alice@test.com' },
        { uid: 'user2', username: 'alicia', displayName: 'Alicia', email: 'alicia@test.com' },
        { uid: 'user3', username: 'alex', displayName: 'Alex', email: 'alex@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await searchUsersPaginated('al', pageSize);

      expect(result.users.length).toBe(pageSize);
      expect(result.hasMore).toBe(true);
    });

    it('should handle partial string matching', async () => {
      const { searchUsersPaginated } = await import('@/services/userService');
      const { getDocs } = await import('firebase/firestore');

      const mockUsers: User[] = [
        { uid: 'user1', username: 'charlie', displayName: 'Charlie Clark', email: 'charlie@test.com' },
        { uid: 'user2', username: 'bob', displayName: 'Bob Brown', email: 'bob@test.com' },
      ];

      const mockDocs = mockUsers.map((user) => ({
        data: () => user,
        id: user.uid,
      }));

      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => mockDocs.forEach(_callback),
        docs: mockDocs,
        size: mockDocs.length,
      } as unknown as ReturnType<typeof getDocs>);

      const result = await searchUsersPaginated('Char', 20);

      expect(result.users.length).toBe(1);
      expect(result.users[0].displayName).toBe('Charlie Clark');
    });
  });

  describe('Performance characteristics', () => {
    it('should use cursor-based pagination for constant performance', async () => {
      const { getPaginatedUsers } = await import('@/services/userService');
      const { orderBy, limit } = await import('firebase/firestore');

      const { getDocs } = await import('firebase/firestore');
      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => {
          // Empty - no docs to iterate
        },
        docs: [],
        size: 0,
      } as unknown as ReturnType<typeof getDocs>);

      await getPaginatedUsers(20);

      // Verify orderBy is called for sorting
      expect(orderBy).toHaveBeenCalledWith('displayName');
      // Verify limit is called
      expect(limit).toHaveBeenCalled();
    });

    it('should not fetch all users before filtering', async () => {
      const { searchUsersPaginated } = await import('@/services/userService');
      const { limit } = await import('firebase/firestore');

      const { getDocs } = await import('firebase/firestore');
      (getDocs as jest.MockedFunction<typeof getDocs>).mockResolvedValue({
        forEach: (_callback: (doc: unknown) => void) => {
          // Empty - no docs to iterate
        },
        docs: [],
        size: 0,
      } as unknown as ReturnType<typeof getDocs>);

      await searchUsersPaginated('test', 20);

      // Verify that limit is called (100 for search)
      expect(limit).toHaveBeenCalled();
    });
  });
});
