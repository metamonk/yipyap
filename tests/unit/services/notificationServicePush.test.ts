/**
 * Unit tests for Notification Service - Push Notification Features
 * @jest-environment node
 */

import { notificationService } from '@/services/notificationService';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import type { Message } from '@/types/models';
import type { NotificationPreferences } from '@/types/user';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('expo-device');

describe('NotificationService - Push Notifications', () => {
  const mockMessage: Message = {
    id: 'msg123',
    conversationId: 'conv456',
    senderId: 'user789',
    text: 'Hello world!',
    status: 'delivered',
    readBy: [],
    timestamp: { toMillis: () => Date.now() } as unknown as Timestamp,
    metadata: { aiProcessed: false },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Device.isDevice as boolean) = true;
  });

  describe('registerForPushNotificationsAsync', () => {
    it('should register and return token on success', async () => {
      const mockToken = 'test-push-token';

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValue({
        data: mockToken,
      });

      const token = await notificationService.registerForPushNotificationsAsync();

      expect(token).toBe(mockToken);
    });

    it('should return null on simulator', async () => {
      (Device.isDevice as boolean) = false;

      const token = await notificationService.registerForPushNotificationsAsync();

      expect(token).toBeNull();
    });
  });

  describe('showNewMessageNotification', () => {
    it('should show notification with preview', async () => {
      await notificationService.showNewMessageNotification(
        mockMessage,
        'John Doe',
        undefined,
        'message',
        true
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'John Doe',
            body: 'John Doe: Hello world!',
          }),
          trigger: null,
        })
      );
    });

    it('should hide preview when disabled', async () => {
      await notificationService.showNewMessageNotification(
        mockMessage,
        'John Doe',
        undefined,
        'message',
        false
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: 'New message',
          }),
        })
      );
    });

    it('should respect preferences', async () => {
      const prefs: NotificationPreferences = {
        enabled: false,
        showPreview: true,
        sound: true,
        vibration: true,
        directMessages: true,
        groupMessages: true,
        systemMessages: true,
      };

      notificationService.setPreferences(prefs);

      await notificationService.showNewMessageNotification(
        mockMessage,
        'John Doe'
      );

      // Should not show notification when disabled
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('badge management', () => {
    it('should increment badge count', async () => {
      (Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(5);
      (Notifications.setBadgeCountAsync as jest.Mock).mockResolvedValue(true);

      await notificationService.incrementBadgeCount();

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(6);
    });

    it('should update badge count', async () => {
      await notificationService.updateBadgeCount(10);

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(10);
    });

    it('should clear badge', async () => {
      await notificationService.clearBadge();

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    });
  });

  describe('permissions', () => {
    it('should check permissions', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const hasPermission = await notificationService.checkPermissions();

      expect(hasPermission).toBe(true);
    });

    it('should request permissions', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const granted = await notificationService.requestPermissions();

      expect(granted).toBe(true);
    });
  });
});
