/**
 * Tests for root layout with protected route pattern
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useRouter, useSegments } from 'expo-router';
import RootLayout from '@/app/_layout';
import { useAuth } from '@/hooks/useAuth';

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react');
  const MockScreen = ({ _name, _options }: { _name: string; _options?: unknown }) => null;
  const MockStack = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  MockStack.Screen = MockScreen;

  return {
    Stack: MockStack,
    useRouter: jest.fn(),
    useSegments: jest.fn(),
  };
});

// Mock useAuth hook
jest.mock('@/hooks/useAuth');

// Mock Firebase initialization
jest.mock('@/services/firebase', () => ({
  initializeFirebase: jest.fn(),
}));

describe('RootLayout - Protected Route Pattern', () => {
  const mockReplace = jest.fn();
  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
  const mockUseSegments = useSegments as jest.MockedFunction<typeof useSegments>;
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      replace: mockReplace,
    } as any);
  });

  describe('Initial App Load - Auth State Check', () => {
    it('should show loading screen while checking auth state', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue([] as any);

      const { UNSAFE_getByType } = render(<RootLayout />);

      // Should show ActivityIndicator (loading screen)
      const ActivityIndicator = require('react-native').ActivityIndicator;
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
      // Verify no redirects happen while loading
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should not redirect while auth state is loading', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(tabs)'] as any);

      render(<RootLayout />);

      // Should not redirect while loading
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Protected Route Pattern', () => {
    it('should redirect to login when unauthenticated user tries to access protected route', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(tabs)'] as any);

      render(<RootLayout />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
      });
    });

    it('should redirect to username-setup when authenticated user without profile is on auth screen', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(auth)', 'login'] as any);

      render(<RootLayout />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(auth)/username-setup');
      });
    });

    it('should redirect to main app when authenticated user with profile is on auth screen', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: { uid: 'test-user-id', username: 'testuser' } as any,
        hasProfile: true,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(auth)', 'login'] as any);

      render(<RootLayout />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
      });
    });

    it('should redirect authenticated users without profile to username-setup when accessing protected routes', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(tabs)'] as any);

      render(<RootLayout />);

      // Should redirect to username-setup - user is authenticated but has no profile
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(auth)/username-setup');
      });
    });

    it('should allow authenticated users with profile to access protected routes', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: { uid: 'test-user-id', username: 'testuser' } as any,
        hasProfile: true,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(tabs)'] as any);

      render(<RootLayout />);

      // Should not redirect - user is authenticated with profile and on protected route
      await waitFor(() => {
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });

    it('should allow unauthenticated users to access auth routes', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(auth)', 'login'] as any);

      render(<RootLayout />);

      // Should not redirect - user is on auth route
      await waitFor(() => {
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });

  describe('Session Persistence', () => {
    it('should maintain authenticated state with profile across re-renders', async () => {
      const mockUser = { uid: 'test-user-id', email: 'test@example.com' } as any;
      const mockUserProfile = { uid: 'test-user-id', username: 'testuser' } as any;

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: mockUser,
        userProfile: mockUserProfile,
        hasProfile: true,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(tabs)'] as any);

      const { rerender } = render(<RootLayout />);

      // Re-render to simulate app state change
      rerender(<RootLayout />);

      // Should not redirect - user stays authenticated with profile
      await waitFor(() => {
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });

  describe('Auth State Transitions', () => {
    it('should redirect to login after logout', async () => {
      // Start authenticated with profile
      const { rerender } = render(<RootLayout />);

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: { uid: 'test-user-id', username: 'testuser' } as any,
        hasProfile: true,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(tabs)'] as any);

      rerender(<RootLayout />);

      // User logs out - auth state changes
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      rerender(<RootLayout />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
      });
    });

    it('should redirect to username-setup after login for new users without profile', async () => {
      // Start unauthenticated on auth screen
      const { rerender } = render(<RootLayout />);

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(auth)', 'login'] as any);

      rerender(<RootLayout />);

      // User logs in but has no profile - auth state changes
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      rerender(<RootLayout />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(auth)/username-setup');
      });
    });

    it('should redirect to main app after login for users with existing profile', async () => {
      // Start unauthenticated on auth screen
      const { rerender } = render(<RootLayout />);

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        userProfile: null,
        hasProfile: false,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });
      mockUseSegments.mockReturnValue(['(auth)', 'login'] as any);

      rerender(<RootLayout />);

      // User logs in with existing profile - auth state changes
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { uid: 'test-user-id' } as any,
        userProfile: { uid: 'test-user-id', username: 'testuser' } as any,
        hasProfile: true,
        signInWithEmailPassword: jest.fn(),
        signUpWithEmailPassword: jest.fn(),
        sendPasswordResetEmail: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      rerender(<RootLayout />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
      });
    });
  });
});
