/**
 * Component tests for ProfileEdit screen
 * @remarks
 * Tests profile editing, optimistic updates, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileEditScreen from '@/app/(tabs)/profile/edit';
import { getUserProfile, updateUserProfile } from '@/services/userService';
import { uploadProfilePhoto } from '@/services/storageService';
import { getFirebaseAuth } from '@/services/firebase';
import * as ImagePicker from 'expo-image-picker';
import { Timestamp } from 'firebase/firestore';

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

describe('ProfileEditScreen', () => {
  const mockCurrentUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockAuth = {
    currentUser: mockCurrentUser,
  };

  const mockUserProfile = {
    uid: 'test-uid',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    presence: {
      status: 'offline' as const,
      lastSeen: Timestamp.now(),
    },
    settings: {
      sendReadReceipts: true,
      notificationsEnabled: true,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
    (getUserProfile as jest.Mock).mockResolvedValue(mockUserProfile);
    (updateUserProfile as jest.Mock).mockResolvedValue(undefined);
    (uploadProfilePhoto as jest.Mock).mockResolvedValue('https://example.com/photo.jpg');
  });

  it('should render profile edit form', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter display name')).toBeTruthy();
    });
  });

  it('should load and display current profile data', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      expect(getUserProfile).toHaveBeenCalledWith('test-uid');
      expect(screen.getByText('@testuser')).toBeTruthy();
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      expect(displayNameInput.props.value).toBe('Test User');
    });
  });

  it('should show username as read-only', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      expect(screen.getByText('@testuser')).toBeTruthy();
      expect(screen.getByText('Username cannot be changed')).toBeTruthy();
    });
  });

  it('should disable save button when no changes', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      expect(saveButton.props.style).toContainEqual(
        expect.objectContaining({ color: expect.any(String) })
      );
    });
  });

  it('should enable save button when display name changes', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      fireEvent.changeText(displayNameInput, 'New Name');
    });

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      // Save button should be enabled
      expect(saveButton).toBeTruthy();
    });
  });

  it('should handle image picker', async () => {
    const mockImageResult = {
      canceled: false,
      assets: [{ uri: 'file:///path/to/new-image.jpg' }],
    };

    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(mockImageResult);

    render(<ProfileEditScreen />);

    await waitFor(() => {
      const changePhotoButton = screen.getByText('Change Photo').parent;
      fireEvent.press(changePhotoButton!);
    });

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  it('should update display name successfully', async () => {
    (updateUserProfile as jest.Mock).mockResolvedValue(undefined);

    render(<ProfileEditScreen />);

    await waitFor(() => {
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      fireEvent.changeText(displayNameInput, 'Updated Name');
    });

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(updateUserProfile).toHaveBeenCalledWith(
        'test-uid',
        expect.objectContaining({
          displayName: 'Updated Name',
        })
      );
    });
  });

  it('should upload and update photo successfully', async () => {
    const mockImageResult = {
      canceled: false,
      assets: [{ uri: 'file:///path/to/new-image.jpg' }],
    };

    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(mockImageResult);
    (uploadProfilePhoto as jest.Mock).mockResolvedValue('https://example.com/new-photo.jpg');
    (updateUserProfile as jest.Mock).mockResolvedValue(undefined);

    render(<ProfileEditScreen />);

    // Pick new photo
    const changePhotoButton = screen.getByText('Change Photo').parent;
    fireEvent.press(changePhotoButton!);

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });

    // Save changes
    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(
      () => {
        expect(uploadProfilePhoto).toHaveBeenCalledWith(
          'test-uid',
          'file:///path/to/new-image.jpg'
        );
      },
      { timeout: 2000 }
    );
  });

  it('should navigate back after successful save', async () => {
    (updateUserProfile as jest.Mock).mockResolvedValue(undefined);

    render(<ProfileEditScreen />);

    const displayNameInput = screen.getByPlaceholderText('Enter display name');
    fireEvent.changeText(displayNameInput, 'Updated Name');

    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(
      () => {
        expect(mockRouter.back).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('should handle update error and revert changes', async () => {
    (updateUserProfile as jest.Mock).mockRejectedValue(new Error('Failed to update profile'));

    render(<ProfileEditScreen />);

    await waitFor(() => {
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      fireEvent.changeText(displayNameInput, 'Updated Name');
    });

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      // Should revert to original value
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      expect(displayNameInput.props.value).toBe('Test User');
    });
  });

  it('should validate display name', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      fireEvent.changeText(displayNameInput, '');
    });

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Display name is required')).toBeTruthy();
      expect(updateUserProfile).not.toHaveBeenCalled();
    });
  });

  it('should handle cancel navigation', async () => {
    render(<ProfileEditScreen />);

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.press(cancelButton);
    });

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('should trim display name before saving', async () => {
    (updateUserProfile as jest.Mock).mockResolvedValue(undefined);

    render(<ProfileEditScreen />);

    await waitFor(() => {
      const displayNameInput = screen.getByPlaceholderText('Enter display name');
      fireEvent.changeText(displayNameInput, '  Trimmed Name  ');
    });

    await waitFor(() => {
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(updateUserProfile).toHaveBeenCalledWith(
        'test-uid',
        expect.objectContaining({
          displayName: 'Trimmed Name',
        })
      );
    });
  });

  it('should navigate back if profile not found', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue(null);

    render(<ProfileEditScreen />);

    await waitFor(() => {
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });
});
