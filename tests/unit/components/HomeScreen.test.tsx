/**
 * Tests for HomeScreen component with logout functionality
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';
import { useAuth } from '@/hooks/useAuth';

// Mock useAuth hook
jest.mock('@/hooks/useAuth');

describe('HomeScreen', () => {
  const mockSignOut = jest.fn();
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
       
      user: { uid: 'test-user-id', email: 'test@example.com' } as any,
      userProfile: null,
      hasProfile: false,
      signInWithEmailPassword: jest.fn(),
      signUpWithEmailPassword: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      signOut: mockSignOut,
      refreshProfile: jest.fn(),
      error: null,
      clearError: jest.fn(),
    });
  });

  it('should render home screen with logout button', () => {
    const { getByText } = render(<HomeScreen />);

    expect(getByText('Home Screen')).toBeTruthy();
    expect(getByText("You're now in the main app!")).toBeTruthy();
    expect(getByText('Logout')).toBeTruthy();
  });

  it('should call signOut when logout button is pressed', async () => {
    mockSignOut.mockResolvedValue(undefined);

    const { getByText } = render(<HomeScreen />);

    const logoutButton = getByText('Logout');
    fireEvent.press(logoutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('should show loading indicator and disable button when signOut is in progress', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
       
      user: { uid: 'test-user-id', email: 'test@example.com' } as any,
      userProfile: null,
      hasProfile: false,
      signInWithEmailPassword: jest.fn(),
      signUpWithEmailPassword: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      signOut: mockSignOut,
      refreshProfile: jest.fn(),
      error: null,
      clearError: jest.fn(),
    });

    const { queryByText, UNSAFE_getByType } = render(<HomeScreen />);

    // Logout button text should not be visible (replaced by ActivityIndicator)
    expect(queryByText('Logout')).toBeNull();

    // ActivityIndicator should be present
    const ActivityIndicator = require('react-native').ActivityIndicator;
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('should handle signOut errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSignOut.mockRejectedValue(new Error('Sign out failed'));

    const { getByText } = render(<HomeScreen />);

    const logoutButton = getByText('Logout');
    fireEvent.press(logoutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });
});
