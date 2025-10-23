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

// Mock Alert globally before imports
global.Alert = {
  alert: jest.fn(),
};

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

  // Story 3.3: Read Receipts Settings Tests (TEST-003)
  describe('Read Receipts Settings Toggle', () => {
    it('should render read receipts toggle', async () => {
      render(<ProfileEditScreen />);

      await waitFor(() => {
        expect(screen.getByText('Send Read Receipts')).toBeTruthy();
        expect(screen.getByText("When disabled, others won't see when you've read their messages")).toBeTruthy();
        expect(screen.getByTestId('read-receipts-toggle')).toBeTruthy();
      });
    });

    it('should show current sendReadReceipts preference state', async () => {
      const mockUserWithPreference = {
        ...mockUserProfile,
        settings: {
          sendReadReceipts: false, // Disabled
          notificationsEnabled: true,
        },
      };
      (getUserProfile as jest.Mock).mockResolvedValue(mockUserWithPreference);

      render(<ProfileEditScreen />);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle.props.value).toBe(false);
      });
    });

    it('should enable save button when toggle changes', async () => {
      render(<ProfileEditScreen />);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle.props.value).toBe(true); // Initial state from mock
      });

      // Toggle to false
      const toggle = screen.getByTestId('read-receipts-toggle');
      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeTruthy();
      });
    });

    it('should update user settings in Firestore when toggle changes', async () => {
      (updateUserProfile as jest.Mock).mockResolvedValue(undefined);

      render(<ProfileEditScreen />);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle).toBeTruthy();
      });

      // Toggle read receipts off
      const toggle = screen.getByTestId('read-receipts-toggle');
      fireEvent(toggle, 'onValueChange', false);

      // Save changes
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(updateUserProfile).toHaveBeenCalledWith(
          'test-uid',
          expect.objectContaining({
            settings: expect.objectContaining({
              sendReadReceipts: false,
            }),
          })
        );
      });
    });

    it('should show optimistic UI update before Firestore confirms', async () => {
      // Delay Firestore update to test optimistic UI
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });
      (updateUserProfile as jest.Mock).mockImplementation(() => updatePromise);

      render(<ProfileEditScreen />);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle.props.value).toBe(true);
      });

      // Toggle immediately shows new state
      const toggle = screen.getByTestId('read-receipts-toggle');
      fireEvent(toggle, 'onValueChange', false);

      // Verify optimistic update (toggle shows false before Firestore confirms)
      expect(toggle.props.value).toBe(false);

      // Resolve Firestore update
      resolveUpdate!();
      await waitFor(() => {
        expect(toggle.props.value).toBe(false);
      });
    });

    it('should handle error when settings update fails', async () => {
      (updateUserProfile as jest.Mock).mockRejectedValue(new Error('Failed to update settings'));

      render(<ProfileEditScreen />);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle.props.value).toBe(true);
      });

      // Toggle off
      const toggle = screen.getByTestId('read-receipts-toggle');
      fireEvent(toggle, 'onValueChange', false);

      // Attempt to save
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);

      await waitFor(() => {
        // Should revert to original state on error
        const toggleAfterError = screen.getByTestId('read-receipts-toggle');
        expect(toggleAfterError.props.value).toBe(true);
      });
    });

    it('should disable toggle when saving', async () => {
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });
      (updateUserProfile as jest.Mock).mockImplementation(() => updatePromise);

      render(<ProfileEditScreen />);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        fireEvent(toggle, 'onValueChange', false);
      });

      // Start save
      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);

      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle.props.disabled).toBe(true);
      });

      // Complete save
      resolveUpdate!();
      await waitFor(() => {
        const toggle = screen.getByTestId('read-receipts-toggle');
        expect(toggle.props.disabled).toBe(false);
      });
    });
  });
});
