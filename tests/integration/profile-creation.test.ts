/**
 * Integration test for complete profile creation flow
 * @remarks
 * Tests the full workflow: registration → username setup → profile creation → main app
 */

import {
  checkUsernameAvailability,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from '@/services/userService';
import { uploadProfilePhoto } from '@/services/storageService';
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { getFirebaseDb, getFirebaseStorage } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('Profile Creation Integration Flow', () => {
  const mockDb = {} as Firestore;
  const mockStorage = {} as FirebaseStorage;
  const mockUid = 'integration-test-uid';
  const mockEmail = 'integration@test.com';
  const mockUsername = 'integrationuser';
  const mockDisplayName = 'Integration User';
  const mockPhotoUri = 'file:///test/photo.jpg';
  const mockPhotoURL = 'https://storage.googleapis.com/photo.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (getFirebaseStorage as jest.Mock).mockReturnValue(mockStorage);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
    (doc as jest.Mock).mockReturnValue('mock-doc-ref');
  });

  describe('Complete profile creation workflow', () => {
    it('should complete full profile creation flow successfully', async () => {
      // Step 1: Check username availability
      const mockUsernameDoc = { exists: () => false };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockUsernameDoc);

      const isAvailable = await checkUsernameAvailability(mockUsername);
      expect(isAvailable).toBe(true);

      // Step 2: Upload profile photo
      const mockBlob = { type: 'image/jpeg' } as globalThis.Blob;
      const mockResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (uploadBytes as jest.Mock).mockResolvedValue(undefined);
      (getDownloadURL as jest.Mock).mockResolvedValue(mockPhotoURL);

      const photoURL = await uploadProfilePhoto(mockUid, mockPhotoUri);
      expect(photoURL).toBe(mockPhotoURL);

      // Step 3: Create user profile
      const mockTransaction = {
        get: jest
          .fn()
          .mockResolvedValueOnce({ exists: () => false }) // username available
          .mockResolvedValueOnce({ exists: () => false }), // user doesn't exist
        set: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) =>
        callback(mockTransaction)
      );

      await createUserProfile(mockUid, mockEmail, {
        username: mockUsername,
        displayName: mockDisplayName,
        photoUri: photoURL,
      });

      expect(mockTransaction.set).toHaveBeenCalledTimes(2);

      // Step 4: Verify profile was created
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          uid: mockUid,
          email: mockEmail,
          username: mockUsername,
          displayName: mockDisplayName,
          photoURL: mockPhotoURL,
        }),
      };

      (getDoc as jest.Mock).mockResolvedValue(mockUserDoc);

      const profile = await getUserProfile(mockUid);
      expect(profile).toBeDefined();
      expect(profile?.username).toBe(mockUsername);
      expect(profile?.displayName).toBe(mockDisplayName);
      expect(profile?.photoURL).toBe(mockPhotoURL);
    });

    it('should handle duplicate username error gracefully', async () => {
      // Step 1: First check shows username available
      const mockUsernameDocAvailable = { exists: () => false };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockUsernameDocAvailable);

      const isAvailable = await checkUsernameAvailability(mockUsername);
      expect(isAvailable).toBe(true);

      // Step 2: Attempt to create profile, but username was taken in the meantime
      const mockTransaction = {
        get: jest.fn().mockResolvedValueOnce({ exists: () => true }), // username now taken
        set: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) =>
        callback(mockTransaction)
      );

      await expect(
        createUserProfile(mockUid, mockEmail, {
          username: mockUsername,
          displayName: mockDisplayName,
        })
      ).rejects.toThrow('Username is already taken');

      // Verify no documents were created
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('should continue profile creation even if photo upload fails', async () => {
      // Step 1: Photo upload fails
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(uploadProfilePhoto(mockUid, mockPhotoUri)).rejects.toThrow();

      // Step 2: Profile creation should still work without photo
      const mockTransaction = {
        get: jest
          .fn()
          .mockResolvedValueOnce({ exists: () => false })
          .mockResolvedValueOnce({ exists: () => false }),
        set: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) =>
        callback(mockTransaction)
      );

      await createUserProfile(mockUid, mockEmail, {
        username: mockUsername,
        displayName: mockDisplayName,
        // No photoUri
      });

      expect(mockTransaction.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('Profile update workflow', () => {
    it('should update profile successfully after creation', async () => {
      // Step 1: Create initial profile
      const mockTransaction = {
        get: jest
          .fn()
          .mockResolvedValueOnce({ exists: () => false })
          .mockResolvedValueOnce({ exists: () => false }),
        set: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) =>
        callback(mockTransaction)
      );

      await createUserProfile(mockUid, mockEmail, {
        username: mockUsername,
        displayName: mockDisplayName,
      });

      // Step 2: Update display name
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile(mockUid, {
        displayName: 'Updated Name',
      });

      expect(updateDoc).toHaveBeenCalled();

      // Step 3: Upload new photo
      const mockBlob = { type: 'image/jpeg' } as globalThis.Blob;
      const mockResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (uploadBytes as jest.Mock).mockResolvedValue(undefined);
      (getDownloadURL as jest.Mock).mockResolvedValue(mockPhotoURL);

      const newPhotoURL = await uploadProfilePhoto(mockUid, mockPhotoUri);

      // Step 4: Update profile with new photo URL
      await updateUserProfile(mockUid, {
        photoURL: newPhotoURL,
      });

      expect(updateDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error recovery scenarios', () => {
    it('should handle network failure during profile creation', async () => {
      (runTransaction as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        createUserProfile(mockUid, mockEmail, {
          username: mockUsername,
          displayName: mockDisplayName,
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle permission denied error', async () => {
      const permissionError = {
        code: 'permission-denied',
        message: 'Insufficient permissions',
      };

      (runTransaction as jest.Mock).mockRejectedValue(permissionError);

      await expect(
        createUserProfile(mockUid, mockEmail, {
          username: mockUsername,
          displayName: mockDisplayName,
        })
      ).rejects.toThrow('Permission denied');
    });

    it('should handle profile not found during update', async () => {
      const firestoreError = {
        code: 'not-found',
        message: 'Document not found',
      };

      (updateDoc as jest.Mock).mockRejectedValue(firestoreError);

      await expect(
        updateUserProfile(mockUid, {
          displayName: 'New Name',
        })
      ).rejects.toThrow('User profile not found');
    });
  });

  describe('Data validation workflow', () => {
    it('should reject all invalid usernames', async () => {
      const invalidUsernames = [
        'ab', // Too short
        'a'.repeat(21), // Too long
        'user@name', // Special character
        'user name', // Space
        'user.name', // Period
        'user-name', // Hyphen
      ];

      for (const invalidUsername of invalidUsernames) {
        await expect(
          createUserProfile(mockUid, mockEmail, {
            username: invalidUsername,
            displayName: mockDisplayName,
          })
        ).rejects.toThrow();
      }
    });

    it('should accept all valid usernames', async () => {
      const validUsernames = [
        'abc', // Minimum length
        'a'.repeat(20), // Maximum length
        'user_name', // Underscore
        'user123', // Numbers
        'user_name_123', // Combination
      ];

      const mockTransaction = {
        get: jest.fn().mockResolvedValue({ exists: () => false }),
        set: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) =>
        callback(mockTransaction)
      );

      for (const validUsername of validUsernames) {
        await expect(
          createUserProfile(mockUid, mockEmail, {
            username: validUsername,
            displayName: mockDisplayName,
          })
        ).resolves.not.toThrow();

        jest.clearAllMocks();
      }
    });
  });
});
