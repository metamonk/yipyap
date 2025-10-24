/**
 * Tests for opportunity notification functions (Story 5.6 - Task 10)
 */

import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock expo-device before any imports
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  getBadgeCountAsync: jest.fn().mockResolvedValue(0),
  setBadgeCountAsync: jest.fn().mockResolvedValue(true),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
  },
  AndroidNotificationVisibility: {
    PUBLIC: 1,
    PRIVATE: 0,
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  currentState: 'active',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock fcmTokenService
jest.mock('@/services/fcmTokenService', () => ({
  fcmTokenService: {
    getToken: jest.fn().mockResolvedValue('mock-token'),
  },
}));

// Mock userService
const mockGetOpportunityNotificationSettings = jest.fn();
const mockGetUserProfile = jest.fn();

jest.mock('@/services/userService', () => {
  return {
    __esModule: true,
    getOpportunityNotificationSettings: (...args: any[]) => mockGetOpportunityNotificationSettings(...args),
    getUserProfile: (...args: any[]) => mockGetUserProfile(...args),
  };
});

// Now import the functions to test
import {
  isInQuietHoursForOpportunities,
  shouldSendOpportunityNotification,
  sendOpportunityNotification,
} from '@/services/notificationService';

describe('Opportunity Notification Functions', () => {
  describe('isInQuietHoursForOpportunities', () => {
    beforeEach(() => {
      // Mock current time to 10:30 AM
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T10:30:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return false when current time is outside quiet hours', () => {
      const quietHours = { start: '22:00', end: '08:00' };
      const result = isInQuietHoursForOpportunities(quietHours);
      expect(result).toBe(false);
    });

    it('should return true when current time is within quiet hours (same day)', () => {
      // Set time to 11:00 PM
      jest.setSystemTime(new Date('2025-01-15T23:00:00'));

      const quietHours = { start: '20:00', end: '23:30' };
      const result = isInQuietHoursForOpportunities(quietHours);
      expect(result).toBe(true);
    });

    it('should handle midnight crossover (evening to morning)', () => {
      // Set time to 1:00 AM
      jest.setSystemTime(new Date('2025-01-15T01:00:00'));

      const quietHours = { start: '22:00', end: '08:00' };
      const result = isInQuietHoursForOpportunities(quietHours);
      expect(result).toBe(true);
    });

    it('should handle midnight crossover (late evening)', () => {
      // Set time to 11:00 PM
      jest.setSystemTime(new Date('2025-01-15T23:00:00'));

      const quietHours = { start: '22:00', end: '08:00' };
      const result = isInQuietHoursForOpportunities(quietHours);
      expect(result).toBe(true);
    });

    it('should return false at boundary (just after quiet hours end)', () => {
      // Set time to 8:00 AM (exactly at end time)
      jest.setSystemTime(new Date('2025-01-15T08:00:00'));

      const quietHours = { start: '22:00', end: '08:00' };
      const result = isInQuietHoursForOpportunities(quietHours);
      expect(result).toBe(false);
    });

    it('should return true at boundary (exactly at start time)', () => {
      // Set time to 10:00 PM
      jest.setSystemTime(new Date('2025-01-15T22:00:00'));

      const quietHours = { start: '22:00', end: '08:00' };
      const result = isInQuietHoursForOpportunities(quietHours);
      expect(result).toBe(true);
    });
  });

  describe('shouldSendOpportunityNotification', () => {
    const mockMessage: Message = {
      id: 'msg123',
      conversationId: 'conv456',
      senderId: 'user789',
      text: 'Test opportunity message',
      status: 'delivered',
      readBy: ['user789'],
      timestamp: Timestamp.now(),
      metadata: {
        opportunityScore: 85,
        opportunityType: 'sponsorship',
        aiProcessed: true,
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T10:30:00')); // 10:30 AM
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true when all conditions are met', async () => {
      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: true,
        minimumScore: 70,
        notifyByType: {
          sponsorship: true,
          collaboration: true,
          partnership: true,
          sale: false,
        },
        quietHours: {
          enabled: false,
        },
      });

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(true);
    });

    it('should return false when settings are disabled', async () => {
      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: false,
        minimumScore: 70,
        notifyByType: {
          sponsorship: true,
          collaboration: true,
          partnership: true,
          sale: false,
        },
      });

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(false);
    });

    it('should return false when score is below minimum threshold', async () => {
      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: true,
        minimumScore: 90, // Higher than message score (85)
        notifyByType: {
          sponsorship: true,
          collaboration: true,
          partnership: true,
          sale: false,
        },
      });

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(false);
    });

    it('should return false when opportunity type is disabled', async () => {
      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: true,
        minimumScore: 70,
        notifyByType: {
          sponsorship: false, // Disabled
          collaboration: true,
          partnership: true,
          sale: false,
        },
      });

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(false);
    });

    it('should return false when in quiet hours', async () => {
      // Set time to 11:00 PM
      jest.setSystemTime(new Date('2025-01-15T23:00:00'));

      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: true,
        minimumScore: 70,
        notifyByType: {
          sponsorship: true,
          collaboration: true,
          partnership: true,
          sale: false,
        },
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
        },
      });

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(false);
    });

    it('should return true when quiet hours are disabled', async () => {
      // Set time to 11:00 PM (would be in quiet hours if enabled)
      jest.setSystemTime(new Date('2025-01-15T23:00:00'));

      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: true,
        minimumScore: 70,
        notifyByType: {
          sponsorship: true,
          collaboration: true,
          partnership: true,
          sale: false,
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
      });

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(true);
    });

    it('should return false when settings cannot be loaded', async () => {
      mockGetOpportunityNotificationSettings.mockRejectedValue(new Error('Firestore error'));

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(false);
    });

    it('should return false when settings are null', async () => {
      mockGetOpportunityNotificationSettings.mockResolvedValue(null);

      const result = await shouldSendOpportunityNotification('user123', mockMessage);
      expect(result).toBe(false);
    });

    it('should handle message without opportunity type', async () => {
      const messageWithoutType: Message = {
        ...mockMessage,
        metadata: {
          opportunityScore: 85,
          aiProcessed: true,
        },
      };

      mockGetOpportunityNotificationSettings.mockResolvedValue({
        enabled: true,
        minimumScore: 70,
        notifyByType: {
          sponsorship: true,
          collaboration: true,
          partnership: true,
          sale: false,
        },
      });

      const result = await shouldSendOpportunityNotification('user123', messageWithoutType);
      expect(result).toBe(true); // Should pass when type is undefined
    });
  });

  describe('sendOpportunityNotification', () => {
    const mockMessage: Message = {
      id: 'msg123',
      conversationId: 'conv456',
      senderId: 'user789',
      text: 'Hey, I have a great sponsorship opportunity for you!',
      status: 'delivered',
      readBy: ['user789'],
      timestamp: Timestamp.now(),
      metadata: {
        opportunityScore: 95,
        opportunityType: 'sponsorship',
        opportunityAnalysis: 'High-value brand sponsorship with clear budget',
        aiProcessed: true,
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send notification with correct payload', async () => {
      const Notifications = require('expo-notifications');

      await sendOpportunityNotification(mockMessage, 'John Doe', 'Brand Deals');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '💼 Sponsorship Opportunity (Score: 95)',
          body: 'John Doe in Brand Deals: High-value brand sponsorship with clear budget',
          data: {
            conversationId: 'conv456',
            senderId: 'user789',
            messageId: 'msg123',
            type: 'business_opportunity',
            timestamp: expect.any(String),
            opportunityScore: 95,
            opportunityType: 'sponsorship',
          },
          sound: 'default',
          badge: 1, // 0 + 1
        },
        trigger: null,
      });
    });

    it('should send notification without conversation name for direct messages', async () => {
      const Notifications = require('expo-notifications');

      await sendOpportunityNotification(mockMessage, 'Jane Smith');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '💼 Sponsorship Opportunity (Score: 95)',
          body: 'Jane Smith: High-value brand sponsorship with clear budget',
          data: expect.any(Object),
          sound: 'default',
          badge: 1,
        },
        trigger: null,
      });
    });

    it('should use message text when analysis is missing', async () => {
      const messageWithoutAnalysis: Message = {
        ...mockMessage,
        metadata: {
          opportunityScore: 85,
          opportunityType: 'collaboration',
          aiProcessed: true,
        },
      };

      const Notifications = require('expo-notifications');

      await sendOpportunityNotification(messageWithoutAnalysis, 'Alice');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: expect.stringContaining('Hey, I have a great sponsorship opportunity'),
          }),
        })
      );
    });

    it('should capitalize opportunity type in title', async () => {
      const collaborationMessage: Message = {
        ...mockMessage,
        metadata: {
          opportunityScore: 80,
          opportunityType: 'partnership',
          opportunityAnalysis: 'Strategic partnership proposal',
          aiProcessed: true,
        },
      };

      const Notifications = require('expo-notifications');

      await sendOpportunityNotification(collaborationMessage, 'Bob');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '💼 Partnership Opportunity (Score: 80)',
          }),
        })
      );
    });

    it('should increment badge count after sending', async () => {
      const Notifications = require('expo-notifications');

      await sendOpportunityNotification(mockMessage, 'Test User');

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(1); // 0 + 1
    });

    it('should throw error when notification fails to schedule', async () => {
      const Notifications = require('expo-notifications');
      Notifications.scheduleNotificationAsync.mockRejectedValueOnce(
        new Error('Notification failed')
      );

      await expect(sendOpportunityNotification(mockMessage, 'Test User')).rejects.toThrow(
        'Notification failed'
      );
    });
  });
});
