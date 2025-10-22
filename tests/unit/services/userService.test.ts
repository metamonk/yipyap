/**
 * Unit tests for userService
 * @remarks
 * Tests username validation, availability checks, profile CRUD operations,
 * and error handling scenarios
 */

import {
  checkUsernameAvailability,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  getUserByUsername,
} from '@/services/userService';
import { doc, getDoc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
}));

describe('userService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = {} as any;
  const mockUid = 'test-uid-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
  });

  describe('checkUsernameAvailability', () => {
    it('should return true if username is available', async () => {
      const mockDoc = { exists: () => false };
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await checkUsernameAvailability('newuser');

      expect(result).toBe(true);
      expect(getDoc).toHaveBeenCalled();
    });

    it('should return false if username is taken', async () => {
      const mockDoc = { exists: () => true };
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await checkUsernameAvailability('existinguser');

      expect(result).toBe(false);
    });

    it('should convert username to lowercase', async () => {
      const mockDoc = { exists: () => false };
      (getDoc as jest.Mock).mockResolvedValue(mockDoc);
      (doc as jest.Mock).mockReturnValue('mock-doc-ref');

      await checkUsernameAvailability('TestUser');

      expect(doc).toHaveBeenCalledWith(mockDb, 'usernames', 'testuser');
    });

    it('should throw error on Firestore failure', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(checkUsernameAvailability('testuser')).rejects.toThrow(
        'Failed to check username availability'
      );
    });
  });

  describe('createUserProfile', () => {
    const validProfileData = {
      username: 'johndoe',
      displayName: 'John Doe',
      photoUri: 'https://example.com/photo.jpg',
    };

    it('should create user profile with valid data', async () => {
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

      await createUserProfile(mockUid, mockEmail, validProfileData);

      expect(mockTransaction.set).toHaveBeenCalledTimes(2); // user doc + username doc
    });

    it('should reject invalid username (too short)', async () => {
      const invalidData = {
        ...validProfileData,
        username: 'ab', // Only 2 characters
      };

      await expect(createUserProfile(mockUid, mockEmail, invalidData)).rejects.toThrow(
        'Username must be at least 3 characters'
      );
    });

    it('should reject invalid username (too long)', async () => {
      const invalidData = {
        ...validProfileData,
        username: 'a'.repeat(21), // 21 characters
      };

      await expect(createUserProfile(mockUid, mockEmail, invalidData)).rejects.toThrow(
        'Username must be 20 characters or less'
      );
    });

    it('should reject invalid username (special characters)', async () => {
      const invalidData = {
        ...validProfileData,
        username: 'user@name', // Contains @
      };

      await expect(createUserProfile(mockUid, mockEmail, invalidData)).rejects.toThrow(
        'Username can only contain letters, numbers, and underscores'
      );
    });

    it('should reject empty display name', async () => {
      const invalidData = {
        ...validProfileData,
        displayName: '',
      };

      await expect(createUserProfile(mockUid, mockEmail, invalidData)).rejects.toThrow(
        'Display name is required'
      );
    });

    it('should reject duplicate username', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValueOnce({ exists: () => true }), // username taken
        set: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) =>
        callback(mockTransaction)
      );

      await expect(createUserProfile(mockUid, mockEmail, validProfileData)).rejects.toThrow(
        'Username is already taken'
      );
    });

    it('should convert username to lowercase', async () => {
      const dataWithUppercase = {
        ...validProfileData,
        username: 'JohnDoe',
      };

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

      await createUserProfile(mockUid, mockEmail, dataWithUppercase);

      // Verify username was lowercased in the call
      const calls = mockTransaction.set.mock.calls;
      expect(calls[0][1].username).toBe('johndoe');
    });

    it('should create user profile without photoURL when photoUri is undefined', async () => {
      const dataWithoutPhoto = {
        username: 'johndoe',
        displayName: 'John Doe',
        photoUri: undefined,
      };

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

      await createUserProfile(mockUid, mockEmail, dataWithoutPhoto);

      // Verify photoURL field is not set (not even as undefined)
      const calls = mockTransaction.set.mock.calls;
      const userDoc = calls[0][1];
      expect(userDoc).not.toHaveProperty('photoURL');
      expect(userDoc.username).toBe('johndoe');
      expect(userDoc.displayName).toBe('John Doe');
    });

    it('should create user profile without photoURL when photoUri is empty string', async () => {
      const dataWithEmptyPhoto = {
        username: 'johndoe',
        displayName: 'John Doe',
        photoUri: '',
      };

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

      await createUserProfile(mockUid, mockEmail, dataWithEmptyPhoto);

      // Verify photoURL field is not set when empty string
      const calls = mockTransaction.set.mock.calls;
      const userDoc = calls[0][1];
      expect(userDoc).not.toHaveProperty('photoURL');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile if exists', async () => {
      const mockUserData = {
        uid: mockUid,
        username: 'johndoe',
        displayName: 'John Doe',
        email: mockEmail,
      };

      const mockDoc = {
        exists: () => true,
        data: () => mockUserData,
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getUserProfile(mockUid);

      expect(result).toEqual(mockUserData);
    });

    it('should return null if profile does not exist', async () => {
      const mockDoc = {
        exists: () => false,
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getUserProfile(mockUid);

      expect(result).toBeNull();
    });

    it('should throw error on Firestore failure', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getUserProfile(mockUid)).rejects.toThrow('Failed to fetch user profile');
    });
  });

  describe('updateUserProfile', () => {
    it('should update display name', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile(mockUid, {
        displayName: 'Jane Doe',
      });

      expect(updateDoc).toHaveBeenCalled();
      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateData.displayName).toBe('Jane Doe');
      expect(updateData.updatedAt).toBeDefined();
    });

    it('should update photo URL', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile(mockUid, {
        photoURL: 'https://example.com/new-photo.jpg',
      });

      expect(updateDoc).toHaveBeenCalled();
      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateData.photoURL).toBe('https://example.com/new-photo.jpg');
    });

    it('should update both display name and photo URL', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile(mockUid, {
        displayName: 'Jane Doe',
        photoURL: 'https://example.com/new-photo.jpg',
      });

      expect(updateDoc).toHaveBeenCalled();
      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateData.displayName).toBe('Jane Doe');
      expect(updateData.photoURL).toBe('https://example.com/new-photo.jpg');
    });

    it('should reject empty display name', async () => {
      await expect(updateUserProfile(mockUid, { displayName: '' })).rejects.toThrow(
        'Display name is required'
      );

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should trim display name', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserProfile(mockUid, {
        displayName: '  Jane Doe  ',
      });

      const updateData = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(updateData.displayName).toBe('Jane Doe');
    });

    it('should throw error on Firestore failure', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(updateUserProfile(mockUid, { displayName: 'Jane Doe' })).rejects.toThrow(
        'Failed to update user profile'
      );
    });
  });

  describe('getUserByUsername', () => {
    it('should return user profile by username', async () => {
      const mockUserData = {
        uid: mockUid,
        username: 'johndoe',
        displayName: 'John Doe',
        email: mockEmail,
      };

      // Mock username document lookup
      const mockUsernameDoc = {
        exists: () => true,
        data: () => ({ uid: mockUid }),
      };

      // Mock user profile lookup
      const mockUserDoc = {
        exists: () => true,
        data: () => mockUserData,
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockUsernameDoc)
        .mockResolvedValueOnce(mockUserDoc);

      const result = await getUserByUsername('johndoe');

      expect(result).toEqual(mockUserData);
    });

    it('should return null if username does not exist', async () => {
      const mockUsernameDoc = {
        exists: () => false,
      };

      (getDoc as jest.Mock).mockResolvedValue(mockUsernameDoc);

      const result = await getUserByUsername('nonexistent');

      expect(result).toBeNull();
    });

    it('should convert username to lowercase', async () => {
      const mockUsernameDoc = { exists: () => false };
      (getDoc as jest.Mock).mockResolvedValue(mockUsernameDoc);
      (doc as jest.Mock).mockReturnValue('mock-doc-ref');

      await getUserByUsername('JohnDoe');

      expect(doc).toHaveBeenCalledWith(mockDb, 'usernames', 'johndoe');
    });
  });
});
