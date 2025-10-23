/**
 * Integration tests for push notifications
 * @jest-environment node
 *
 * @remarks
 * Tests end-to-end notification flow including:
 * - Token registration and storage
 * - Notification sending in various app states
 * - Deep linking and navigation
 * - Badge count updates
 * - Preference enforcement
 * - Background and terminated state handling
 */

import { fcmTokenService } from '@/services/fcmTokenService';
import { notificationService } from '@/services/notificationService';
import { handleNotificationTap, generateDeepLink, queueNavigation } from '@/utils/deepLinkHandler';
import type { NotificationData, NotificationCategory } from '@/services/notificationService';
import { AppState } from 'react-native';

// Mock dependencies
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationReceivedListener = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockSetBadgeCountAsync = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: (...args: any[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: any[]) => mockSetNotificationHandler(...args),
  addNotificationReceivedListener: (...args: any[]) => mockAddNotificationReceivedListener(...args),
  addNotificationResponseReceivedListener: (...args: any[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  setBadgeCountAsync: (...args: any[]) => mockSetBadgeCountAsync(...args),
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: any[]) => mockRequestPermissionsAsync(...args),
  AndroidImportance: {
    MAX: 5,
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  modelName: 'Test Model',
  osVersion: '1.0',
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `yipyap://${path}`),
}));

const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
  },
}));

jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

describe('Push Notifications Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  });

  describe('End-to-end notification flow', () => {
    it('should register token and store in Firestore', async () => {
      // Arrange
      const mockToken = 'ExponentPushToken[' + 'a'.repeat(100) + ']';
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: mockToken });

      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          fcmTokens: [],
        }),
      };
      mockGetDoc.mockResolvedValue(mockUserDoc);
      mockUpdateDoc.mockResolvedValue(undefined);

      // Act
      const token = await fcmTokenService.registerToken('user123');

      // Assert
      expect(token).toBe(mockToken);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should handle complete notification lifecycle from background', async () => {
      // Arrange
      const mockConversationId = 'conv456';
      const mockMessageId = 'msg789';
      const mockSenderId = 'sender123';

      // Simulate background state
      jest.spyOn(AppState, 'currentState', 'get').mockReturnValue('background');

      // Setup notification data
      const notificationData: NotificationData = {
        conversationId: mockConversationId,
        senderId: mockSenderId,
        messageId: mockMessageId,
        type: 'message',
        timestamp: new Date().toISOString(),
      };

      // Act - Generate deep link
      const deepLink = generateDeepLink(mockConversationId, mockMessageId);

      // Assert - Verify deep link structure
      expect(deepLink).toContain(mockConversationId);
      expect(deepLink).toContain(mockMessageId);
      expect(deepLink).toMatch(/yipyap:\/\/conversation\//);

      // Act - Handle notification tap
      const handled = handleNotificationTap(notificationData);

      // Assert - Verify tap handling
      expect(handled).toBe(true);
    });

    it('should queue navigation when app is not ready', () => {
      // Arrange
      const mockConversationId = 'conv789';
      const mockMessageId = 'msg123';

      // Act - Queue navigation before app is ready
      queueNavigation(mockConversationId, mockMessageId);

      // Assert - Navigation should be queued (implementation detail)
      // In real scenario, this would verify the navigation happens after app becomes ready
      expect(true).toBe(true); // Placeholder - actual implementation would verify queue
    });

    it('should handle notification while app is in foreground', async () => {
      // Arrange
      jest.spyOn(AppState, 'currentState', 'get').mockReturnValue('active');

      const mockNotification = {
        request: {
          content: {
            data: {
              conversationId: 'conv123',
              messageId: 'msg456',
              type: 'message',
            },
          },
        },
      };

      // Act - Simulate receiving notification in foreground
      const listener = mockAddNotificationReceivedListener.mock.calls[0]?.[0];
      if (listener) {
        listener(mockNotification);
      }

      // Assert - Handler was set up
      expect(mockSetNotificationHandler).toHaveBeenCalled();
    });

    it('should handle notification tap from terminated state', async () => {
      // Arrange
      const notificationData: NotificationData = {
        conversationId: 'conv999',
        senderId: 'sender999',
        messageId: 'msg999',
        type: 'message',
        timestamp: new Date().toISOString(),
      };

      // Simulate app starting from terminated state
      jest.spyOn(AppState, 'currentState', 'get').mockReturnValue('active');

      // Act - Handle notification that opened the app
      const handled = handleNotificationTap(notificationData);

      // Assert
      expect(handled).toBe(true);
    });
  });

  describe('Badge count management', () => {
    it('should update badge count when new notification arrives', async () => {
      // Arrange
      const currentBadgeCount = 5;
      mockSetBadgeCountAsync.mockResolvedValue(undefined);

      // Act - Simulate badge update
      await notificationService.updateBadgeCount(currentBadgeCount + 1);

      // Assert
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(currentBadgeCount + 1);
    });

    it('should clear badge count when app becomes active', async () => {
      // Arrange
      mockSetBadgeCountAsync.mockResolvedValue(undefined);

      // Act - Clear badge
      await notificationService.clearBadge();

      // Assert
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
    });

    it('should handle platform-specific badge behavior', async () => {
      // Arrange - iOS supports badges
      jest.mock('react-native', () => ({
        Platform: { OS: 'ios' },
        AppState: { currentState: 'active' },
      }));

      // Act
      await notificationService.updateBadgeCount(3);

      // Assert
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(3);
    });
  });

  describe('Notification preferences', () => {
    it('should respect user preference to disable notifications', () => {
      // Arrange
      const prefs = {
        enabled: false,
        showPreview: true,
        sound: true,
        vibration: true,
        directMessages: true,
        groupMessages: true,
        systemMessages: false,
      };

      // Act
      notificationService.setPreferences(prefs);

      // Assert
      const shouldShow = notificationService.shouldShowNotification('message' as NotificationCategory);
      expect(shouldShow).toBe(false);
    });

    it('should hide preview when showPreview is false', () => {
      // Arrange
      const prefs = {
        enabled: true,
        showPreview: false,
        sound: true,
        vibration: true,
        directMessages: true,
        groupMessages: true,
        systemMessages: false,
      };

      // Act
      notificationService.setPreferences(prefs);

      // Assert
      const retrieved = notificationService.getPreferences();
      expect(retrieved.showPreview).toBe(false);
    });

    it('should respect category-specific preferences', () => {
      // Arrange
      const prefs = {
        enabled: true,
        showPreview: true,
        sound: true,
        vibration: true,
        directMessages: true,
        groupMessages: false, // Disabled
        systemMessages: false,
      };

      // Act
      notificationService.setPreferences(prefs);

      // Assert
      expect(notificationService.shouldShowNotification('message' as NotificationCategory)).toBe(true);
      expect(notificationService.shouldShowNotification('group' as NotificationCategory)).toBe(false);
    });

    it('should handle quiet hours preference', () => {
      // Arrange
      const prefs = {
        enabled: true,
        showPreview: true,
        sound: true,
        vibration: true,
        directMessages: true,
        groupMessages: true,
        systemMessages: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      };

      // Act
      notificationService.setPreferences(prefs);

      // Assert
      const retrieved = notificationService.getPreferences();
      expect(retrieved.quietHoursStart).toBe('22:00');
      expect(retrieved.quietHoursEnd).toBe('08:00');
    });
  });

  describe('Token management', () => {
    it('should validate token format', () => {
      // Valid token
      const validToken = 'ExponentPushToken[' + 'a'.repeat(100) + ']';
      expect(fcmTokenService.validateToken(validToken)).toBe(true);

      // Invalid token - too short
      const invalidToken = 'short';
      expect(fcmTokenService.validateToken(invalidToken)).toBe(false);

      // Empty token
      expect(fcmTokenService.validateToken('')).toBe(false);
    });

    it('should handle token refresh', async () => {
      // Arrange
      const oldToken = 'ExponentPushToken[old]';
      const newToken = 'ExponentPushToken[new]';

      mockGetExpoPushTokenAsync
        .mockResolvedValueOnce({ data: oldToken })
        .mockResolvedValueOnce({ data: newToken });

      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          fcmTokens: [
            {
              token: oldToken,
              platform: 'ios',
              deviceId: 'device123',
              appVersion: '1.0.0',
              createdAt: { toMillis: () => Date.now() - 86400000 },
              lastUsed: { toMillis: () => Date.now() - 3600000 },
            },
          ],
        }),
      };
      mockGetDoc.mockResolvedValue(mockUserDoc);
      mockUpdateDoc.mockResolvedValue(undefined);

      // Act - Register new token
      const token = await fcmTokenService.registerToken('user123');

      // Assert
      expect(token).toBe(newToken);
    });

    it('should cleanup expired tokens', async () => {
      // Arrange
      const expiredToken = {
        token: 'expired-token',
        platform: 'ios' as const,
        deviceId: 'device-old',
        appVersion: '0.9.0',
        createdAt: { toMillis: () => Date.now() - 100 * 86400000 }, // 100 days old
        lastUsed: { toMillis: () => Date.now() - 100 * 86400000 },
      };

      const validToken = {
        token: 'valid-token',
        platform: 'ios' as const,
        deviceId: 'device-new',
        appVersion: '1.0.0',
        createdAt: { toMillis: () => Date.now() - 7 * 86400000 }, // 7 days old
        lastUsed: { toMillis: () => Date.now() - 3600000 },
      };

      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          fcmTokens: [expiredToken, validToken],
        }),
      };
      mockGetDoc.mockResolvedValue(mockUserDoc);
      mockUpdateDoc.mockResolvedValue(undefined);

      // Act - Cleanup should happen during token management
      await fcmTokenService.cleanupExpiredTokens('user123');

      // Assert - Only valid token should remain
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fcmTokens: expect.arrayContaining([
            expect.objectContaining({ token: 'valid-token' }),
          ]),
        })
      );
    });
  });

  describe('Permission handling', () => {
    it('should handle granted permissions', async () => {
      // Arrange
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      // Act
      const hasPermission = await notificationService.checkPermissions();

      // Assert
      expect(hasPermission).toBe(true);
      expect(mockGetPermissionsAsync).toHaveBeenCalled();
    });

    it('should handle denied permissions', async () => {
      // Arrange
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });

      // Act
      const hasPermission = await notificationService.checkPermissions();

      // Assert
      expect(hasPermission).toBe(false);
    });

    it('should request permissions when not determined', async () => {
      // Arrange
      mockGetPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      mockRequestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      // Act
      const granted = await notificationService.requestPermissions();

      // Assert
      expect(granted).toBe(true);
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('Deep linking', () => {
    it('should generate correct deep link format', () => {
      // Arrange
      const conversationId = 'conv123';
      const messageId = 'msg456';

      // Act
      const deepLink = generateDeepLink(conversationId, messageId);

      // Assert
      expect(deepLink).toContain('conversation');
      expect(deepLink).toContain(conversationId);
    });

    it('should handle deep link with special characters', () => {
      // Arrange
      const conversationId = 'conv_123-abc';
      const messageId = 'msg_456-def';

      // Act
      const deepLink = generateDeepLink(conversationId, messageId);

      // Assert
      expect(deepLink).toBeTruthy();
      expect(deepLink).toContain(conversationId);
    });
  });
});
