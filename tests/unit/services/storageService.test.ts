/**
 * Unit tests for storageService
 * @remarks
 * Tests profile photo upload, deletion, and URL retrieval
 */

import {
  uploadProfilePhoto,
  deleteProfilePhoto,
  getProfilePhotoURL,
} from '@/services/storageService';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from '@/services/firebase';

// Type declarations for global objects
declare global {
  var fetch: jest.Mock;
   
  var Blob: any;
}

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock Blob for Node.js environment
if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(
      public parts: Array<unknown>,
      public options?: { type?: string }
    ) {}
     
  } as any;
}

describe('storageService', () => {
   
  const mockStorage = {} as any;
  const mockUserId = 'test-uid-123';
  const mockImageUri = 'file:///path/to/image.jpg';
  const mockDownloadURL = 'https://firebasestorage.googleapis.com/photo.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseStorage as jest.Mock).mockReturnValue(mockStorage);
  });

  describe('uploadProfilePhoto', () => {
    it('should upload photo successfully', async () => {
      // eslint-disable-next-line no-undef
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const mockResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (uploadBytes as jest.Mock).mockResolvedValue(undefined);
      (getDownloadURL as jest.Mock).mockResolvedValue(mockDownloadURL);

      const result = await uploadProfilePhoto(mockUserId, mockImageUri);

      expect(result).toBe(mockDownloadURL);
      // eslint-disable-next-line no-undef
      expect(fetch).toHaveBeenCalledWith(mockImageUri);
      expect(uploadBytes).toHaveBeenCalled();
      expect(getDownloadURL).toHaveBeenCalled();
    });

    it('should throw error if image URI is empty', async () => {
      await expect(uploadProfilePhoto(mockUserId, '')).rejects.toThrow('Image URI is required');
    });

    it('should throw error if user ID is empty', async () => {
      await expect(uploadProfilePhoto('', mockImageUri)).rejects.toThrow('User ID is required');
    });

    it('should throw error if fetch fails', async () => {
      const mockResponse = {
        ok: false,
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(uploadProfilePhoto(mockUserId, mockImageUri)).rejects.toThrow(
        'Failed to upload profile photo'
      );
    });

    it('should throw error on storage upload failure', async () => {
      // eslint-disable-next-line no-undef
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const mockResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (uploadBytes as jest.Mock).mockRejectedValue(new Error('Upload failed'));

      await expect(uploadProfilePhoto(mockUserId, mockImageUri)).rejects.toThrow(
        'Failed to upload profile photo'
      );
    });

    it('should use correct storage path', async () => {
      // eslint-disable-next-line no-undef
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const mockResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (uploadBytes as jest.Mock).mockResolvedValue(undefined);
      (getDownloadURL as jest.Mock).mockResolvedValue(mockDownloadURL);

      await uploadProfilePhoto(mockUserId, mockImageUri);

      expect(ref).toHaveBeenCalledWith(mockStorage, `users/${mockUserId}/profile.jpg`);
    });

    it('should handle permission denied error', async () => {
      // eslint-disable-next-line no-undef
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const mockResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      const storageError = {
        code: 'storage/unauthorized',
        message: 'Unauthorized',
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (uploadBytes as jest.Mock).mockRejectedValue(storageError);

      await expect(uploadProfilePhoto(mockUserId, mockImageUri)).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('deleteProfilePhoto', () => {
    it('should delete photo successfully', async () => {
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (deleteObject as jest.Mock).mockResolvedValue(undefined);

      await deleteProfilePhoto(mockUserId);

      expect(deleteObject).toHaveBeenCalled();
      expect(ref).toHaveBeenCalledWith(mockStorage, `users/${mockUserId}/profile.jpg`);
    });

    it('should throw error if user ID is empty', async () => {
      await expect(deleteProfilePhoto('')).rejects.toThrow('User ID is required');
    });

    it('should not throw error if photo does not exist', async () => {
      const storageError = {
        code: 'storage/object-not-found',
        message: 'Not found',
      };

      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (deleteObject as jest.Mock).mockRejectedValue(storageError);

      // Should not throw
      await expect(deleteProfilePhoto(mockUserId)).resolves.not.toThrow();
    });

    it('should throw error on other storage failures', async () => {
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (deleteObject as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(deleteProfilePhoto(mockUserId)).rejects.toThrow(
        'Failed to delete profile photo'
      );
    });
  });

  describe('getProfilePhotoURL', () => {
    it('should return photo URL if exists', async () => {
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (getDownloadURL as jest.Mock).mockResolvedValue(mockDownloadURL);

      const result = await getProfilePhotoURL(mockUserId);

      expect(result).toBe(mockDownloadURL);
    });

    it('should return null if photo does not exist', async () => {
      const storageError = {
        code: 'storage/object-not-found',
        message: 'Not found',
      };

      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (getDownloadURL as jest.Mock).mockRejectedValue(storageError);

      const result = await getProfilePhotoURL(mockUserId);

      expect(result).toBeNull();
    });

    it('should throw error if user ID is empty', async () => {
      await expect(getProfilePhotoURL('')).rejects.toThrow('User ID is required');
    });

    it('should throw error on other storage failures', async () => {
      (ref as jest.Mock).mockReturnValue('mock-storage-ref');
      (getDownloadURL as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getProfilePhotoURL(mockUserId)).rejects.toThrow(
        'Failed to get profile photo URL'
      );
    });
  });
});
