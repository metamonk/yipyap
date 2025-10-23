/**
 * Custom hook for paginated user list with search support
 *
 * @remarks
 * Provides pagination, search, and loading state management for user lists.
 * Automatically handles page loading, error states, and search queries.
 */

import { useState, useCallback, useEffect } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import type { User } from '@/types/user';
import { getPaginatedUsers, searchUsersPaginated } from '@/services/userService';

/**
 * State returned by usePaginatedUsers hook
 */
export interface UsePaginatedUsersResult {
  /** Current array of users */
  users: User[];

  /** Whether data is being fetched */
  loading: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Whether there are more pages to load */
  hasMore: boolean;

  /** Function to load the next page */
  loadMore: () => Promise<void>;

  /** Function to refresh/reload from first page */
  refresh: () => Promise<void>;

  /** Function to set search query */
  setSearchQuery: (query: string) => void;

  /** Current search query */
  searchQuery: string;
}

/**
 * Hook for managing paginated user lists with optional search
 *
 * @param pageSize - Number of users per page (default: 20)
 * @returns Pagination state and control functions
 *
 * @remarks
 * Features:
 * - Cursor-based pagination for constant performance
 * - Search support with debouncing
 * - Automatic loading state management
 * - Error handling
 * - Pull-to-refresh support via refresh()
 *
 * @example
 * ```tsx
 * function UserSelectionScreen() {
 *   const {
 *     users,
 *     loading,
 *     hasMore,
 *     loadMore,
 *     refresh,
 *     setSearchQuery,
 *     searchQuery
 *   } = usePaginatedUsers(20);
 *
 *   return (
 *     <View>
 *       <TextInput
 *         value={searchQuery}
 *         onChangeText={setSearchQuery}
 *         placeholder="Search users..."
 *       />
 *       <FlatList
 *         data={users}
 *         onEndReached={hasMore ? loadMore : undefined}
 *         refreshing={loading}
 *         onRefresh={refresh}
 *       />
 *     </View>
 *   );
 * }
 * ```
 */
export function usePaginatedUsers(pageSize: number = 20): UsePaginatedUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Loads the next page of users
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);

      let result;
      if (searchQuery.trim()) {
        result = await searchUsersPaginated(searchQuery, pageSize, lastDoc);
      } else {
        result = await getPaginatedUsers(pageSize, lastDoc);
      }

      setUsers((prev) => [...prev, ...result.users]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
      console.error('Error loading more users:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, searchQuery, pageSize, lastDoc]);

  /**
   * Refreshes the user list from the beginning
   */
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLastDoc(null);

      let result;
      if (searchQuery.trim()) {
        result = await searchUsersPaginated(searchQuery, pageSize, null);
      } else {
        result = await getPaginatedUsers(pageSize, null);
      }

      setUsers(result.users);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh users';
      setError(errorMessage);
      console.error('Error refreshing users:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, pageSize]);

  /**
   * Single unified effect for search query changes and initial load
   * This prevents race conditions from multiple dependent effects
   */
  useEffect(() => {
    let isCancelled = false;

    // Debounce search query changes (but not initial mount)
    const timeoutId = setTimeout(
      async () => {
        if (isCancelled) return;

        try {
          setLoading(true);
          setError(null);

          let result;
          if (searchQuery.trim()) {
            result = await searchUsersPaginated(searchQuery, pageSize, null);
          } else {
            result = await getPaginatedUsers(pageSize, null);
          }

          if (!isCancelled) {
            setUsers(result.users);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
          }
        } catch (err) {
          if (!isCancelled) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
            setError(errorMessage);
            console.error('Error loading users:', err);
          }
        } finally {
          if (!isCancelled) {
            setLoading(false);
          }
        }
      },
      searchQuery ? 300 : 0 // Debounce search changes, but load immediately on mount
    );

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, pageSize]);

  return {
    users,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    setSearchQuery,
    searchQuery,
  };
}
