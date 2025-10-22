/**
 * Component tests for UsernameSetup screen
 * @remarks
 * Tests form validation, username availability checking, and profile creation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import UsernameSetup from '@/app/(auth)/username-setup';
import { checkUsernameAvailability, createUserProfile } from '@/services/userService';
import { uploadProfilePhoto } from '@/services/storageService';
import { getFirebaseAuth } from '@/services/firebase';
import * as ImagePicker from 'expo-image-picker';

// Mock dependencies
jest.mock('@/services/userService');
jest.mock('@/services/storageService');
jest.mock('@/services/firebase');
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock expo-router
const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('UsernameSetup', () => {
  const mockCurrentUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockAuth = {
    currentUser: mockCurrentUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);
    (createUserProfile as jest.Mock).mockResolvedValue({});
    (uploadProfilePhoto as jest.Mock).mockResolvedValue('https://example.com/photo.jpg');
  });

  it('should render username setup form', () => {
    render(<UsernameSetup />);

    expect(screen.getByText('Complete Your Profile')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter username')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter display name')).toBeTruthy();
    expect(screen.getByText('Complete Profile')).toBeTruthy();
  });

  it('should pre-populate display name from Firebase Auth', () => {
    render(<UsernameSetup />);

    const displayNameInput = screen.getByPlaceholderText('Enter display name');
    expect(displayNameInput.props.value).toBe('Test User');
  });

  it('should validate username length (too short)', async () => {
    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(usernameInput, 'ab');

    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters')).toBeTruthy();
    });
  });

  it('should validate username format (special characters)', async () => {
    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(usernameInput, 'user@name');

    await waitFor(() => {
      expect(
        screen.getByText('Username can only contain letters, numbers, and underscores')
      ).toBeTruthy();
    });
  });

  it('should check username availability', async () => {
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);

    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(usernameInput, 'validuser');

    await waitFor(
      () => {
        expect(checkUsernameAvailability).toHaveBeenCalledWith('validuser');
      },
      { timeout: 1000 }
    );
  });

  it('should show error if username is taken', async () => {
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(false);

    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(usernameInput, 'takenuser');

    await waitFor(
      () => {
        expect(screen.getByText('Username is already taken')).toBeTruthy();
      },
      { timeout: 1000 }
    );
  });

  it('should convert username to lowercase', async () => {
    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    fireEvent.changeText(usernameInput, 'UserName');

    expect(usernameInput.props.value).toBe('username');
  });

  it('should disable submit button when form is invalid', () => {
    render(<UsernameSetup />);

    const submitButton = screen.getByText('Complete Profile');

    // Test behavior: pressing disabled button should not trigger createUserProfile
    fireEvent.press(submitButton);

    // Verify createUserProfile was not called (button is effectively disabled)
    expect(createUserProfile).not.toHaveBeenCalled();
  });

  it('should enable submit button when form is valid', async () => {
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);
    (createUserProfile as jest.Mock).mockResolvedValue({});

    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const displayNameInput = screen.getByPlaceholderText('Enter display name');

    fireEvent.changeText(usernameInput, 'validuser');
    fireEvent.changeText(displayNameInput, 'Valid Name');

    // Wait for username availability check to complete
    await waitFor(
      () => {
        expect(checkUsernameAvailability).toHaveBeenCalledWith('validuser');
      },
      { timeout: 1000 }
    );

    // Test behavior: button should now be enabled and allow submission
    const submitButton = screen.getByText('Complete Profile');
    fireEvent.press(submitButton);

    // Verify createUserProfile was called (button is enabled)
    await waitFor(
      () => {
        expect(createUserProfile).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('should handle image picker', async () => {
    const mockImageResult = {
      canceled: false,
      assets: [{ uri: 'file:///path/to/image.jpg' }],
    };

    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(mockImageResult);

    render(<UsernameSetup />);

    const addPhotoButton = screen.getByText('Add Photo').parent;
    fireEvent.press(addPhotoButton!);

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  it('should submit profile successfully', async () => {
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);
    (createUserProfile as jest.Mock).mockResolvedValue({});

    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const displayNameInput = screen.getByPlaceholderText('Enter display name');

    fireEvent.changeText(usernameInput, 'johndoe');
    fireEvent.changeText(displayNameInput, 'John Doe');

    // Wait for username availability check to complete
    await waitFor(
      () => {
        expect(checkUsernameAvailability).toHaveBeenCalledWith('johndoe');
      },
      { timeout: 1000 }
    );

    // Now submit the form
    const submitButton = screen.getByText('Complete Profile');
    fireEvent.press(submitButton);

    await waitFor(
      () => {
        expect(createUserProfile).toHaveBeenCalledWith(
          'test-uid',
          'test@example.com',
          expect.objectContaining({
            username: 'johndoe',
            displayName: 'John Doe',
          })
        );
      },
      { timeout: 2000 }
    );
  });

  it('should navigate to tabs after successful profile creation', async () => {
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);
    (createUserProfile as jest.Mock).mockResolvedValue({});

    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const displayNameInput = screen.getByPlaceholderText('Enter display name');

    fireEvent.changeText(usernameInput, 'johndoe');
    fireEvent.changeText(displayNameInput, 'John Doe');

    // Wait for username availability check to complete
    await waitFor(
      () => {
        expect(checkUsernameAvailability).toHaveBeenCalledWith('johndoe');
      },
      { timeout: 1000 }
    );

    // Submit the form
    const submitButton = screen.getByText('Complete Profile');
    fireEvent.press(submitButton);

    await waitFor(
      () => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      },
      { timeout: 2000 }
    );
  });

  it('should upload photo if provided', async () => {
    const mockImageResult = {
      canceled: false,
      assets: [{ uri: 'file:///path/to/image.jpg' }],
    };

    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(mockImageResult);
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);
    (uploadProfilePhoto as jest.Mock).mockResolvedValue('https://example.com/photo.jpg');
    (createUserProfile as jest.Mock).mockResolvedValue({});

    render(<UsernameSetup />);

    // Add photo
    const addPhotoButton = screen.getByText('Add Photo').parent;
    fireEvent.press(addPhotoButton!);

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });

    // Fill form
    const usernameInput = screen.getByPlaceholderText('Enter username');
    const displayNameInput = screen.getByPlaceholderText('Enter display name');

    fireEvent.changeText(usernameInput, 'johndoe');
    fireEvent.changeText(displayNameInput, 'John Doe');

    // Wait for username availability check
    await waitFor(
      () => {
        expect(checkUsernameAvailability).toHaveBeenCalledWith('johndoe');
      },
      { timeout: 1000 }
    );

    // Submit the form
    const submitButton = screen.getByText('Complete Profile');
    fireEvent.press(submitButton);

    await waitFor(
      () => {
        expect(uploadProfilePhoto).toHaveBeenCalledWith('test-uid', 'file:///path/to/image.jpg');
      },
      { timeout: 2000 }
    );
  });

  it('should handle profile creation error', async () => {
    (checkUsernameAvailability as jest.Mock).mockResolvedValue(true);
    (createUserProfile as jest.Mock).mockRejectedValue(new Error('Failed to create profile'));

    render(<UsernameSetup />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const displayNameInput = screen.getByPlaceholderText('Enter display name');

    fireEvent.changeText(usernameInput, 'johndoe');
    fireEvent.changeText(displayNameInput, 'John Doe');

    await waitFor(
      () => {
        const submitButton = screen.getByText('Complete Profile');
        fireEvent.press(submitButton);
      },
      { timeout: 1000 }
    );

    await waitFor(() => {
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });
});
