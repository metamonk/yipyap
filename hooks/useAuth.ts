/**
 * Custom hook for managing user authentication state
 * @remarks
 * Provides centralized authentication state management with real-time updates
 * from Firebase Auth. Handles loading states, errors, and user session persistence.
 * @example
 * ```tsx
 * function LoginScreen() {
 *   const { user, isLoading, isAuthenticated, signInWithEmailPassword, error } = useAuth();
 *
 *   if (isLoading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return (
 *     <Button onPress={() => signInWithEmailPassword(email, password)}>
 *       Sign In
 *     </Button>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/services/firebase';
import {
  signInWithEmailPassword as authSignInWithEmailPassword,
  signUpWithEmailPassword as authSignUpWithEmailPassword,
  sendPasswordResetEmail as authSendPasswordResetEmail,
  signOut as authSignOut,
} from '@/services/authService';
import { getUserProfile } from '@/services/userService';
import { AuthError } from '@/types/auth';
import { User } from '@/types/user';

/**
 * Return type for useAuth hook
 */
export interface UseAuthReturn {
  /** Current authenticated user, null if not authenticated */
  user: FirebaseUser | null;

  /** User profile from Firestore, null if not found or not authenticated */
  userProfile: User | null;

  /** Whether user has completed profile setup */
  hasProfile: boolean;

  /** Loading state during authentication operations */
  isLoading: boolean;

  /** Whether user is currently authenticated */
  isAuthenticated: boolean;

  /** Function to sign in with email and password */
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;

  /** Function to sign up with email and password */
  signUpWithEmailPassword: (email: string, password: string, displayName?: string) => Promise<void>;

  /** Function to send password reset email */
  sendPasswordResetEmail: (email: string) => Promise<void>;

  /** Function to sign out current user */
  signOut: () => Promise<void>;

  /** Manually refresh user profile from Firestore */
  refreshProfile: () => Promise<void>;

  /** Current authentication error, null if no error */
  error: AuthError | null;

  /** Function to clear current error */
  clearError: () => void;
}

/**
 * Hook for managing authentication state and operations
 * @returns Authentication state and functions
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Set up Firebase auth state listener
  useEffect(() => {
    let auth: ReturnType<typeof getFirebaseAuth>;
    let unsubscribe: (() => void) | undefined;

    try {
      auth = getFirebaseAuth();
    } catch (error) {
      console.error('Failed to get Firebase Auth:', error);
      setError({
        code: 'auth/initialization-error',
        message: error instanceof Error ? error.message : 'Failed to initialize authentication',
        userMessage: 'Authentication service is not available. Please restart the app.',
      });
      setIsLoading(false);
      return;
    }

    // Listen for auth state changes
    unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);

        // If user is authenticated, check if they have a profile
        if (firebaseUser) {
          try {
            const profile = await getUserProfile(firebaseUser.uid);
            setUserProfile(profile);
          } catch (error) {
            console.error('Error fetching user profile:', error);
            // Don't set error state here, as this is not a critical failure
            // User might just need to create their profile
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }

        setIsLoading(false);
      },
      (authError) => {
        console.error('Auth state change error:', authError);
        setError({
          code: 'auth/state-change-error',
          message: authError.message,
          userMessage: 'Authentication state error. Please try again.',
        });
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Sign in with email and password
   */
  const signInWithEmailPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await authSignInWithEmailPassword(email, password);
        // User state will be updated by onAuthStateChanged listener
      } catch (err) {
        console.error('Sign-in error:', err);
        setError(err as AuthError);
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Sign up with email and password
   */
  const signUpWithEmailPassword = useCallback(
    async (email: string, password: string, displayName?: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        await authSignUpWithEmailPassword(email, password, displayName);
        // User state will be updated by onAuthStateChanged listener
      } catch (err) {
        console.error('Sign-up error:', err);
        setError(err as AuthError);
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Send password reset email
   */
  const sendPasswordResetEmail = useCallback(async (email: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await authSendPasswordResetEmail(email);
      setIsLoading(false);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err as AuthError);
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign out current user
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await authSignOut();
      // User state will be updated by onAuthStateChanged listener
    } catch (err) {
      console.error('Sign-out error:', err);
      setError(err as AuthError);
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Manually refresh user profile from Firestore
   * @remarks
   * Call this after profile creation or updates that occur outside of onAuthStateChanged.
   * This ensures the hasProfile state is updated immediately without waiting for auth state changes.
   * @example
   * ```tsx
   * await createUserProfile(uid, email, profileData);
   * await refreshProfile(); // Update profile state
   * router.replace('/(tabs)'); // Now hasProfile will be true
   * ```
   */
  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    try {
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error refreshing profile:', error);
      setUserProfile(null);
    }
  }, [user]);

  return {
    user,
    userProfile,
    hasProfile: userProfile !== null,
    isLoading,
    isAuthenticated: user !== null,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    sendPasswordResetEmail,
    signOut,
    refreshProfile,
    error,
    clearError,
  };
}
