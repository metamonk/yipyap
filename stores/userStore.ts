/**
 * Zustand store for managing user profile state
 *
 * @remarks
 * Centralized state management for the current user's profile.
 * Stores the user profile data and provides actions to update it.
 */

import { create } from 'zustand';
import type { User } from '@/types/user';

/**
 * User store state and actions interface
 *
 * @remarks
 * Defines the shape of the user store including both state and actions.
 */
interface UserState {
  /** Current user's profile data (null if not loaded) */
  currentUser: User | null;

  /** Loading state for user profile (true while fetching initial data) */
  isLoading: boolean;

  /**
   * Sets the current user profile
   *
   * @param user - User profile data to store, or null to clear
   *
   * @example
   * ```typescript
   * const { setCurrentUser } = useUserStore();
   * setCurrentUser(userProfile);
   * ```
   */
  setCurrentUser: (user: User | null) => void;

  /**
   * Updates the current user profile with partial data
   *
   * @param updates - Partial user data to merge with existing profile
   *
   * @remarks
   * Merges the updates with existing user data.
   * Useful for updating specific fields like displayName or photoURL.
   *
   * @example
   * ```typescript
   * const { updateCurrentUser } = useUserStore();
   * updateCurrentUser({
   *   displayName: 'New Name',
   *   photoURL: 'https://...'
   * });
   * ```
   */
  updateCurrentUser: (updates: Partial<User>) => void;

  /**
   * Sets the loading state
   *
   * @param loading - New loading state
   *
   * @example
   * ```typescript
   * const { setLoading } = useUserStore();
   * setLoading(true);
   * ```
   */
  setLoading: (loading: boolean) => void;

  /**
   * Clears the user profile from the store
   *
   * @remarks
   * Useful for logout scenarios
   *
   * @example
   * ```typescript
   * const { clearUser } = useUserStore();
   * clearUser();
   * ```
   */
  clearUser: () => void;
}

/**
 * Zustand store hook for user profile state management
 *
 * @remarks
 * Use this hook in components to access and modify user profile state.
 * The store automatically handles state updates and triggers re-renders.
 *
 * @example
 * ```typescript
 * function ProfileScreen() {
 *   const { currentUser, isLoading } = useUserStore();
 *
 *   if (isLoading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return <Text>{currentUser?.displayName}</Text>;
 * }
 * ```
 */
export const useUserStore = create<UserState>((set) => ({
  // Initial state
  currentUser: null,
  isLoading: false,

  // Actions
  setCurrentUser: (user) => set({ currentUser: user }),

  updateCurrentUser: (updates) =>
    set((state) => ({
      currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  clearUser: () => set({ currentUser: null, isLoading: false }),
}));
