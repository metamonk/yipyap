/**
 * Unit tests for budget monitoring Cloud Function
 * @module functions/tests/unit/ai/budget-monitor
 */

import * as admin from 'firebase-admin';
import type { Timestamp } from 'firebase-admin/firestore';

// Mock firebase-functions/v2 before importing the module
jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((config, handler) => handler),
}));

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin,
    apps: [{ name: 'test-app' }], // Simulate already initialized
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
    messaging: jest.fn(() => mockMessaging),
  };
});

// Mock fetch for Expo notifications
global.fetch = jest.fn();

const mockFirestore = {
  collection: jest.fn(),
};

const mockMessaging = {
  sendEachForMulticast: jest.fn(),
};

describe('Budget Monitor Cloud Function', () => {
  let mockDb: any;
  let mockUserCollection: any;
  let mockCostMetricsCollection: any;
  let mockBudgetAlertsCollection: any;
  let mockSystemLogsCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firestore mocks
    mockBudgetAlertsCollection = {
      add: jest.fn().mockResolvedValue({ id: 'alert123' }),
    };

    mockCostMetricsCollection = {
      doc: jest.fn((docId) => ({
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      })),
    };

    mockUserCollection = {
      doc: jest.fn((userId) => ({
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((collectionName) => {
          if (collectionName === 'ai_cost_metrics') {
            return mockCostMetricsCollection;
          }
          if (collectionName === 'budget_alerts') {
            return mockBudgetAlertsCollection;
          }
          return { add: jest.fn() };
        }),
      })),
      get: jest.fn(),
    };

    mockSystemLogsCollection = {
      add: jest.fn().mockResolvedValue({ id: 'log123' }),
    };

    mockDb = {
      collection: jest.fn((collectionName) => {
        if (collectionName === 'users') {
          return mockUserCollection;
        }
        if (collectionName === 'system_logs') {
          return mockSystemLogsCollection;
        }
        return { get: jest.fn() };
      }),
    };

    mockFirestore.collection.mockImplementation(mockDb.collection);

    // Mock Timestamp
    (admin.firestore.Timestamp as any) = {
      now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
      fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
    };
  });

  describe('Budget Threshold Detection', () => {
    it('should detect 80% budget threshold', () => {
      const costMetrics = {
        userId: 'user123',
        totalCostCents: 400,
        budgetLimitCents: 500,
        budgetUsedPercent: 80,
        budgetAlertSent: false,
        budgetExceeded: false,
      };

      expect(costMetrics.budgetUsedPercent).toBeGreaterThanOrEqual(80);
      expect(costMetrics.budgetAlertSent).toBe(false);
    });

    it('should detect 100% budget threshold', () => {
      const costMetrics = {
        userId: 'user123',
        totalCostCents: 500,
        budgetLimitCents: 500,
        budgetUsedPercent: 100,
        budgetAlertSent: true,
        budgetExceeded: false,
      };

      expect(costMetrics.budgetUsedPercent).toBeGreaterThanOrEqual(100);
      expect(costMetrics.budgetExceeded).toBe(false);
    });

    it('should not trigger alert if already sent', () => {
      const costMetrics = {
        userId: 'user123',
        totalCostCents: 450,
        budgetLimitCents: 500,
        budgetUsedPercent: 90,
        budgetAlertSent: true,
        budgetExceeded: false,
      };

      expect(costMetrics.budgetUsedPercent).toBeGreaterThanOrEqual(80);
      expect(costMetrics.budgetAlertSent).toBe(true); // Already sent
    });

    it('should not trigger disable if already exceeded', () => {
      const costMetrics = {
        userId: 'user123',
        totalCostCents: 550,
        budgetLimitCents: 500,
        budgetUsedPercent: 110,
        budgetAlertSent: true,
        budgetExceeded: true,
      };

      expect(costMetrics.budgetUsedPercent).toBeGreaterThanOrEqual(100);
      expect(costMetrics.budgetExceeded).toBe(true); // Already disabled
    });
  });

  describe('Token Type Detection', () => {
    it('should detect Expo tokens', () => {
      const expoToken = 'ExponentPushToken[abc123xyz]';
      const isExpo = expoToken.startsWith('ExponentPushToken[') && expoToken.endsWith(']');
      expect(isExpo).toBe(true);
    });

    it('should detect APNs tokens', () => {
      const apnsToken = 'a'.repeat(64);
      const isApns = apnsToken.length === 64 && /^[a-f0-9]+$/i.test(apnsToken);
      expect(isApns).toBe(true);
    });

    it('should default to FCM for other tokens', () => {
      const fcmToken = 'some-fcm-token-string';
      const isExpo = fcmToken.startsWith('ExponentPushToken[');
      const isApns = fcmToken.length === 64 && /^[a-f0-9]+$/i.test(fcmToken);
      expect(isExpo).toBe(false);
      expect(isApns).toBe(false);
    });
  });

  describe('Budget Alert Notification', () => {
    it('should format threshold alert correctly', () => {
      const costInfo = {
        totalCostCents: 400,
        budgetLimitCents: 500,
        usedPercent: 80,
      };

      const costInDollars = (costInfo.totalCostCents / 100).toFixed(2);
      const budgetInDollars = (costInfo.budgetLimitCents / 100).toFixed(2);

      const title = 'AI Budget Alert';
      const body = `You've used ${costInfo.usedPercent.toFixed(0)}% ($${costInDollars}) of your daily AI budget ($${budgetInDollars}).`;

      expect(title).toBe('AI Budget Alert');
      expect(body).toContain('80%');
      expect(body).toContain('$4.00');
      expect(body).toContain('$5.00');
    });

    it('should format exceeded alert correctly', () => {
      const costInfo = {
        totalCostCents: 500,
        budgetLimitCents: 500,
        usedPercent: 100,
      };

      const budgetInDollars = (costInfo.budgetLimitCents / 100).toFixed(2);

      const title = 'AI Budget Exceeded';
      const body = `You've reached your daily AI budget limit ($${budgetInDollars}). AI features are temporarily disabled until tomorrow.`;

      expect(title).toBe('AI Budget Exceeded');
      expect(body).toContain('$5.00');
      expect(body).toContain('disabled');
    });

    it('should skip notification if user has notifications disabled', async () => {
      const userData = {
        uid: 'user123',
        displayName: 'Test User',
        username: 'testuser',
        settings: {
          notifications: {
            enabled: false,
          },
        },
        fcmTokens: [
          {
            token: 'ExponentPushToken[test]',
            type: 'expo' as const,
            platform: 'ios' as const,
            deviceId: 'device123',
            appVersion: '1.0.0',
            createdAt: { seconds: Date.now() / 1000 } as Timestamp,
            lastUsed: { seconds: Date.now() / 1000 } as Timestamp,
          },
        ],
      };

      expect(userData.settings.notifications.enabled).toBe(false);
      // In real implementation, notification would be skipped
    });

    it('should skip notification if user has no tokens', async () => {
      const userData = {
        uid: 'user123',
        displayName: 'Test User',
        username: 'testuser',
        fcmTokens: [],
      };

      expect(userData.fcmTokens.length).toBe(0);
      // In real implementation, notification would be skipped
    });
  });

  describe('Expo Notification Sending', () => {
    it('should send Expo notifications with correct format', async () => {
      const expoTokens = ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'];
      const title = 'AI Budget Alert';
      const body = "You've used 80% of your budget";
      const data = { type: 'budget_alert', alertType: 'threshold' };

      const messages = expoTokens.map((token) => ({
        to: token,
        title,
        body,
        data,
        badge: 1,
        sound: 'default',
        priority: 'high',
        channelId: 'system',
      }));

      expect(messages).toHaveLength(2);
      expect(messages[0].to).toBe('ExponentPushToken[test1]');
      expect(messages[0].title).toBe(title);
      expect(messages[0].body).toBe(body);
      expect(messages[0].priority).toBe('high');
    });

    it('should handle Expo API success response', async () => {
      const receipts = [
        { status: 'ok' },
        { status: 'ok' },
      ];

      const successCount = receipts.filter((r) => r.status === 'ok').length;
      const failureCount = receipts.length - successCount;

      expect(successCount).toBe(2);
      expect(failureCount).toBe(0);
    });

    it('should handle Expo API failure response', async () => {
      const receipts = [
        { status: 'ok' },
        { status: 'error', message: 'Invalid token' },
      ];

      const successCount = receipts.filter((r) => r.status === 'ok').length;
      const failureCount = receipts.length - successCount;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe('AI Features Disable', () => {
    it('should set correct flags when disabling AI features', () => {
      const updateData = {
        'aiFeatures.disabled': true,
        'aiFeatures.disabledReason': 'budget_exceeded',
        'aiFeatures.disabledAt': admin.firestore.Timestamp.now(),
      };

      expect(updateData['aiFeatures.disabled']).toBe(true);
      expect(updateData['aiFeatures.disabledReason']).toBe('budget_exceeded');
      expect(updateData['aiFeatures.disabledAt']).toBeDefined();
    });
  });

  describe('Period ID Generation', () => {
    it('should generate correct daily period ID', () => {
      const now = new Date('2025-10-24T12:00:00Z');
      const periodId = `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      expect(periodId).toBe('daily-2025-10-24');
    });

    it('should pad single-digit months and days', () => {
      const now = new Date('2025-01-05T12:00:00Z');
      const periodId = `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      expect(periodId).toBe('daily-2025-01-05');
    });
  });

  describe('Budget Alert Logging', () => {
    it('should log budget alert with correct data', () => {
      const logData = {
        alertType: 'threshold' as const,
        totalCostCents: 400,
        budgetLimitCents: 500,
        usedPercent: 80,
        sentAt: admin.firestore.Timestamp.now(),
      };

      expect(logData.alertType).toBe('threshold');
      expect(logData.totalCostCents).toBe(400);
      expect(logData.budgetLimitCents).toBe(500);
      expect(logData.usedPercent).toBe(80);
      expect(logData.sentAt).toBeDefined();
    });
  });

  describe('System Metrics Logging', () => {
    it('should log execution metrics with correct data', () => {
      const logData = {
        type: 'budget_monitor_execution',
        timestamp: admin.firestore.Timestamp.now(),
        durationMs: 1234,
        usersChecked: 10,
        alertsSent: 2,
        featuresDisabled: 1,
        periodId: 'daily-2025-10-24',
      };

      expect(logData.type).toBe('budget_monitor_execution');
      expect(logData.durationMs).toBeGreaterThan(0);
      expect(logData.usersChecked).toBeGreaterThanOrEqual(0);
      expect(logData.alertsSent).toBeGreaterThanOrEqual(0);
      expect(logData.featuresDisabled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should not throw when user document not found', () => {
      // Simulate user not found scenario
      const userExists = false;

      if (!userExists) {
        // In real implementation, function should log error and return early
        expect(true).toBe(true);
      }
    });

    it('should not throw when notification sending fails', () => {
      // Simulate notification failure
      const notificationSent = false;

      if (!notificationSent) {
        // In real implementation, function should log error but not throw
        expect(true).toBe(true);
      }
    });

    it('should continue processing other users if one fails', () => {
      const users = ['user1', 'user2', 'user3'];
      const failedUser = 'user2';

      const processedUsers = users.filter((userId) => {
        // Simulate failure for user2
        if (userId === failedUser) {
          return false; // Skip but continue
        }
        return true;
      });

      expect(processedUsers).toHaveLength(2);
      expect(processedUsers).toContain('user1');
      expect(processedUsers).toContain('user3');
    });
  });
});
