/**
 * Unit tests for FCM Token Service
 * @jest-environment node
 */

import { fcmTokenService } from '@/services/fcmTokenService';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { FCMToken } from '@/types/user';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('expo-device');
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

// Mock Firestore
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockArrayUnion = jest.fn((val) => val);
const mockArrayRemove = jest.fn((val) => val);

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(...args),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
  },
}));

describe('FCMTokenService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Device.isDevice as boolean) = true;
  });

  describe('getFCMToken', () => {
    it('should return null on simulator', async () => {
      (Device.isDevice as boolean) = false;

      const token = await fcmTokenService.getFCMToken();

      expect(token).toBeNull();
    });

    it('should return null when permissions not granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const token = await fcmTokenService.getFCMToken();

      expect(token).toBeNull();
    });

    it('should get token when permissions granted', async () => {
      const mockToken = 'test-fcm-token-123';

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValue({
        data: mockToken,
      });

      const token = await fcmTokenService.getFCMToken();

      expect(token).toBe(mockToken);
      expect(Notifications.getDevicePushTokenAsync).toHaveBeenCalled();
    });

    it('should request permissions if not granted', async () => {
      const mockToken = 'test-fcm-token-123';

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValue({
        data: mockToken,
      });

      const token = await fcmTokenService.getFCMToken();

      expect(token).toBe(mockToken);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission error')
      );

      await expect(fcmTokenService.getFCMToken()).rejects.toThrow();
    });
  });

  describe('saveFCMToken', () => {
    const token = 'fcm-token-abc';

    beforeEach(() => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ fcmTokens: [] }),
      });
    });

    it('should save token to Firestore', async () => {
      const userId = 'user123';
      const savedToken = await fcmTokenService.saveFCMToken(userId, token);

      expect(savedToken.token).toBe(token);
      expect(savedToken.platform).toBe(Platform.OS);
      expect(savedToken.appVersion).toBe('1.0.0');
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should include device metadata', async () => {
      const userId = 'user123';
      const savedToken = await fcmTokenService.saveFCMToken(userId, token);

      expect(savedToken.deviceId).toBeDefined();
      expect(savedToken.createdAt).toBeDefined();
      expect(savedToken.lastUsed).toBeDefined();
    });

    it('should cleanup old tokens', async () => {
      const userId = 'user123';
      const createMockTimestamp = (ms: number) => ({ toMillis: () => ms });
      const oldTokens: FCMToken[] = Array.from({ length: 6 }, (_, i) => ({
        token: `old-token-${i}`,
        type: 'fcm' as const,
        platform: 'ios' as const,
        deviceId: `device-${i}`,
        appVersion: '1.0.0',
        createdAt: createMockTimestamp(Date.now() - 100 * 24 * 60 * 60 * 1000) as unknown as FCMToken['createdAt'],
        lastUsed: createMockTimestamp(Date.now() - 100 * 24 * 60 * 60 * 1000) as unknown as FCMToken['lastUsed'],
      }));

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ fcmTokens: oldTokens }),
      });

      await fcmTokenService.saveFCMToken(userId, token);

      // Should remove stale tokens
      expect(mockArrayRemove).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should return false for invalid tokens', () => {
      expect(fcmTokenService.validateToken('')).toBe(false);
      expect(fcmTokenService.validateToken('short')).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(fcmTokenService.validateToken(null)).toBe(false);
    });

    it('should return true for valid tokens', () => {
      const validToken = 'a'.repeat(150); // Long token
      expect(fcmTokenService.validateToken(validToken)).toBe(true);
    });
  });

  describe('updateTokenLastUsed', () => {
    const token = 'fcm-token-abc';

    it('should update lastUsed timestamp', async () => {
      const userId = 'user123';
      const createMockTimestamp = (ms: number) => ({ toMillis: () => ms });
      const existingToken: FCMToken = {
        token,
        type: 'fcm',
        platform: 'ios',
        deviceId: 'device-123',
        appVersion: '1.0.0',
        createdAt: createMockTimestamp(Date.now() - 1000) as unknown as FCMToken['createdAt'],
        lastUsed: createMockTimestamp(Date.now() - 1000) as unknown as FCMToken['lastUsed'],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ fcmTokens: [existingToken] }),
      });

      await fcmTokenService.updateTokenLastUsed(userId, token);

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should handle missing user gracefully', async () => {
      const userId = 'user123';
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      // Should not throw
      await fcmTokenService.updateTokenLastUsed(userId, token);
    });
  });

  describe('onTokenRefresh', () => {
    it('should set up refresh listener', () => {
      const callback = jest.fn();
      const cleanup = fcmTokenService.onTokenRefresh('user123', callback);

      expect(typeof cleanup).toBe('function');

      // Cleanup should work
      cleanup();
    });
  });
});
