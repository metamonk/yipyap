/**
 * Unit tests for useAuth hook with Email/Password authentication
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/hooks/useAuth';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/services/firebase';
import * as authService from '@/services/authService';

// Mock dependencies
jest.mock('firebase/auth');
jest.mock('@/services/firebase');
jest.mock('@/services/authService');

describe('useAuth', () => {
  const mockAuth = { name: 'mockAuth' };
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  let authStateCallback: (user: unknown) => void;
  let authStateErrorCallback: ((error: Error) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);

    // Mock onAuthStateChanged
    (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback, errorCallback) => {
      authStateCallback = callback;
      authStateErrorCallback = errorCallback;
      return jest.fn(); // unsubscribe function
    });
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should update user state when auth state changes', async () => {
    const { result } = renderHook(() => useAuth());

    // Simulate user sign-in
    act(() => {
      authStateCallback(mockUser);
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should update to unauthenticated when user signs out', async () => {
    const { result } = renderHook(() => useAuth());

    // First sign in
    act(() => {
      authStateCallback(mockUser);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Then sign out
    act(() => {
      authStateCallback(null);
    });

    await waitFor(() => {
      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle auth state change errors', async () => {
    const { result } = renderHook(() => useAuth());

    const error = new Error('Auth state error');
    act(() => {
      authStateErrorCallback?.(error);
    });

    await waitFor(() => {
      expect(result.current.error).toMatchObject({
        code: 'auth/state-change-error',
        message: 'Auth state error',
        userMessage: 'Authentication state error. Please try again.',
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('signUpWithEmailPassword', () => {
    it('should successfully sign up with email and password', async () => {
      (authService.signUpWithEmailPassword as jest.Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUpWithEmailPassword(
          'test@example.com',
          'SecurePass123',
          'Test User'
        );
      });

      expect(authService.signUpWithEmailPassword).toHaveBeenCalledWith(
        'test@example.com',
        'SecurePass123',
        'Test User'
      );
    });

    it('should handle sign-up errors', async () => {
      const mockError = {
        code: 'auth/email-already-in-use',
        message: 'Email already in use',
        userMessage: 'This email is already registered. Please sign in or use a different email.',
      };

      (authService.signUpWithEmailPassword as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUpWithEmailPassword('test@example.com', 'SecurePass123');
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set loading state during sign-up', async () => {
      let resolveSignUp: () => void;
      const signUpPromise = new Promise<void>((resolve) => {
        resolveSignUp = resolve;
      });

      (authService.signUpWithEmailPassword as jest.Mock).mockReturnValue(signUpPromise);

      const { result } = renderHook(() => useAuth());

      // Start sign-up (don't await yet)
      act(() => {
        result.current.signUpWithEmailPassword('test@example.com', 'SecurePass123');
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Complete sign-up
      await act(async () => {
        resolveSignUp!();
        await signUpPromise;
      });
    });
  });

  describe('signInWithEmailPassword', () => {
    it('should successfully sign in with email and password', async () => {
      (authService.signInWithEmailPassword as jest.Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInWithEmailPassword('test@example.com', 'SecurePass123');
      });

      expect(authService.signInWithEmailPassword).toHaveBeenCalledWith(
        'test@example.com',
        'SecurePass123'
      );
    });

    it('should handle sign-in errors', async () => {
      const mockError = {
        code: 'auth/wrong-password',
        message: 'Wrong password',
        userMessage: 'Incorrect password. Please try again.',
      };

      (authService.signInWithEmailPassword as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInWithEmailPassword('test@example.com', 'WrongPass');
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should successfully send password reset email', async () => {
      (authService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.sendPasswordResetEmail('test@example.com');
      });

      expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle password reset errors', async () => {
      const mockError = {
        code: 'auth/user-not-found',
        message: 'User not found',
        userMessage: 'No account found with this email. Please register first.',
      };

      (authService.sendPasswordResetEmail as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.sendPasswordResetEmail('notfound@example.com');
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      (authService.signOut as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(authService.signOut).toHaveBeenCalled();
    });

    it('should handle sign-out errors', async () => {
      const mockError = {
        code: 'auth/network-request-failed',
        message: 'Network error',
        userMessage: 'Network error. Please check your connection and try again.',
      };

      (authService.signOut as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('clearError', () => {
    it('should clear error when clearError is called', async () => {
      const mockError = {
        code: 'auth/wrong-password',
        message: 'Wrong password',
        userMessage: 'Incorrect password. Please try again.',
      };

      (authService.signInWithEmailPassword as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuth());

      // Trigger error
      await act(async () => {
        await result.current.signInWithEmailPassword('test@example.com', 'wrong');
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
      });

      // Clear error
      act(() => {
        result.current.clearError();
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });

    it('should clear error when starting new authentication', async () => {
      const mockError = {
        code: 'auth/wrong-password',
        message: 'Wrong password',
        userMessage: 'Incorrect password. Please try again.',
      };

      // First sign-in fails
      (authService.signInWithEmailPassword as jest.Mock).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signInWithEmailPassword('test@example.com', 'wrong');
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
      });

      // Second sign-in succeeds
      (authService.signInWithEmailPassword as jest.Mock).mockResolvedValueOnce(mockUser);

      await act(async () => {
        await result.current.signInWithEmailPassword('test@example.com', 'correct');
      });

      // Error should be cleared
      expect(result.current.error).toBe(null);
    });
  });

  it('should cleanup auth listener on unmount', () => {
    const unsubscribe = jest.fn();
    (onAuthStateChanged as jest.Mock).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useAuth());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
