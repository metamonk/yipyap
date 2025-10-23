/**
 * Unit tests for user notification settings update functionality
 */

import { updateNotificationPreferences, getNotificationPreferences } from '@/services/userService';
import { NotificationPreferences } from '@/types/user';
import { updateDoc, getDoc } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn((db, ...pathSegments) => ({
    path: pathSegments.join('/'),
  })),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 })),
}));

// Mock Firebase service
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({
    _type: 'firestore',
  })),
}));

describe('User Service - Notification Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateNotificationPreferences', () => {
    const userId = 'test-user-123';
    const mockPreferences: NotificationPreferences = {
      enabled: true,
      showPreview: true,
      sound: true,
      vibration: true,
      directMessages: true,
      groupMessages: true,
      systemMessages: true,
    };

    it('should update global notification enabled setting', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await updateNotificationPreferences(userId, mockPreferences);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `users/${userId}` }),
        expect.objectContaining({
          'settings.notifications': mockPreferences,
        })
      );
    });

    it('should handle updating notification preferences with quiet hours', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      const prefsWithQuietHours: NotificationPreferences = {
        ...mockPreferences,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      };

      await updateNotificationPreferences(userId, prefsWithQuietHours);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `users/${userId}` }),
        expect.objectContaining({
          'settings.notifications': prefsWithQuietHours,
        })
      );
    });

    it('should throw error when userId is invalid', async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce({
        code: 'not-found',
      });

      await expect(updateNotificationPreferences('', mockPreferences)).rejects.toThrow(
        'User profile not found'
      );
    });

    it('should handle Firestore errors gracefully', async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(updateNotificationPreferences(userId, mockPreferences)).rejects.toThrow(
        'Failed to update notification preferences'
      );
    });

    it('should throw permission-denied error when user lacks permission', async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce({
        code: 'permission-denied',
      });

      await expect(updateNotificationPreferences(userId, mockPreferences)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should handle partial preferences update', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);

      const partialPrefs: NotificationPreferences = {
        enabled: false,
        showPreview: true,
        sound: true,
        vibration: true,
        directMessages: true,
        groupMessages: true,
        systemMessages: true,
      };

      await updateNotificationPreferences(userId, partialPrefs);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `users/${userId}` }),
        expect.objectContaining({
          'settings.notifications': partialPrefs,
        })
      );
    });
  });

  describe('getNotificationPreferences', () => {
    const userId = 'test-user-123';
    const mockPreferences: NotificationPreferences = {
      enabled: true,
      showPreview: true,
      sound: true,
      vibration: true,
      directMessages: true,
      groupMessages: true,
      systemMessages: true,
    };

    it('should get notification preferences for a user', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: userId,
          settings: {
            notifications: mockPreferences,
          },
        }),
      });

      const result = await getNotificationPreferences(userId);

      expect(result).toEqual(mockPreferences);
    });

    it('should return null if user does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getNotificationPreferences(userId);

      expect(result).toBeNull();
    });

    it('should return null if user has no notification settings', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: userId,
          settings: {},
        }),
      });

      const result = await getNotificationPreferences(userId);

      expect(result).toBeNull();
    });

    it('should handle Firestore errors', async () => {
      (getDoc as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(getNotificationPreferences(userId)).rejects.toThrow(
        'Failed to fetch notification preferences'
      );
    });
  });
});
