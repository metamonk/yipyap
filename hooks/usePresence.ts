/**
 * Custom hook for presence management
 * @module hooks/usePresence
 */

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { presenceService } from '@/services/presenceService';

/**
 * Hook that automatically manages user presence based on auth state
 * @remarks
 * Add this to your root layout to track presence globally
 * @example
 * ```tsx
 * // In app/_layout.tsx
 * function RootLayout() {
 *   usePresence(); // Automatically tracks presence
 *   return <Stack />;
 * }
 * ```
 */
export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      // Initialize presence tracking for authenticated user
      presenceService.initialize(user.uid);
    }

    // Cleanup on unmount or when user changes
    return () => {
      presenceService.cleanup();
    };
  }, [user?.uid]);
}
