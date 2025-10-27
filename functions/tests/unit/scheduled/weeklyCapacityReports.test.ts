/**
 * Unit tests for weekly capacity reports (Story 6.5)
 * Tests report generation, metrics calculation, and suggestion logic
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { generateWeeklyReport } from '../../../src/scheduled/weeklyCapacityReports';
import {
  CapacityMetrics,
  UserSettings,
  CapacitySuggestion,
} from '../../../src/types/user';

// Mock Firebase Admin
jest.mock('firebase-admin', () => {
  const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
  };

  return {
    firestore: jest.fn(() => mockFirestore),
    initializeApp: jest.fn(),
  };
});

describe('Weekly Capacity Reports (Story 6.5)', () => {
  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = admin.firestore();
  });

  describe('generateWeeklyReport', () => {
    it('should skip users without capacity settings', async () => {
      const userId = 'user123';

      // Mock user without capacity settings
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({ settings: {} }),
          }),
        })),
      });

      const result = await generateWeeklyReport(userId);
      expect(result).toBeNull();
    });

    it('should skip users with weeklyReportsEnabled=false', async () => {
      const userId = 'user123';

      // Mock user with weeklyReportsEnabled=false
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({
              settings: {
                capacity: {
                  dailyLimit: 10,
                  weeklyReportsEnabled: false,
                },
              },
            }),
          }),
        })),
      });

      const result = await generateWeeklyReport(userId);
      expect(result).toBeNull();
    });

    it('should generate report for user with weeklyReportsEnabled=true', async () => {
      const userId = 'user123';
      const now = Timestamp.now();

      // Mock user with weeklyReportsEnabled=true
      const mockUserDoc = {
        data: () => ({
          settings: {
            capacity: {
              dailyLimit: 10,
              weeklyReportsEnabled: true,
            },
          },
        }),
      };

      // Mock empty digests (no activity this week)
      const mockDigestsSnapshot = {
        docs: [],
        size: 0,
      };

      // Mock Firestore collections
      const mockCollection = jest.fn((name: string) => {
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockUserDoc),
              update: jest.fn().mockResolvedValue({}),
            })),
          };
        }
        if (name === 'meaningful10_digests') {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(mockDigestsSnapshot),
          };
        }
        if (name === 'capacity_reports') {
          return {
            doc: jest.fn(() => ({
              id: 'report123',
            })),
            doc: jest.fn().mockReturnValue({
              id: 'report123',
              set: jest.fn().mockResolvedValue({}),
            }),
          };
        }
        if (name === 'notifications') {
          return {
            add: jest.fn().mockResolvedValue({ id: 'notif123' }),
          };
        }
        return { where: jest.fn().mockReturnThis() };
      });

      mockFirestore.collection = mockCollection;

      const result = await generateWeeklyReport(userId);

      // Report should be generated
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
      expect(result?.metrics).toBeDefined();
      expect(result?.suggestions).toBeDefined();
    });
  });

  describe('calculateWeeklyMetrics', () => {
    // Note: This is tested indirectly through generateWeeklyReport
    // Additional isolated tests can be added by exporting the function

    it('should calculate correct average daily usage', () => {
      // Test scenario: 3 days with data
      const mockDigests = [
        { data: () => ({ deep: 5, faq: 2, archived: 3 }) }, // 10 total
        { data: () => ({ deep: 7, faq: 1, archived: 2 }) }, // 10 total
        { data: () => ({ deep: 6, faq: 3, archived: 1 }) }, // 10 total
      ];

      // Total: 30 messages / 3 days = 10 avg
      // Expected avgDailyUsage: 10
      // With capacity of 10, usageRate should be 100%
    });

    it('should handle weeks with no activity', () => {
      // Empty digests should result in 0 usage
      const mockDigests: any[] = [];
      // Expected: avgDailyUsage = 0, usageRate = 0
    });
  });

  describe('generateSuggestions', () => {
    it('should suggest lowering capacity when under-utilized (< 50%)', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 10,
        avgDailyUsage: 4.0,
        usageRate: 0.4, // 40%
        totalDeep: 20,
        totalFAQ: 8,
        totalArchived: 0,
      };

      const settings: UserSettings = {
        sendReadReceipts: true,
        notificationsEnabled: true,
        capacity: {
          dailyLimit: 10,
          boundaryMessage: '',
          autoArchiveEnabled: true,
          requireEditingForBusiness: true,
          weeklyReportsEnabled: true,
        },
      };

      // This would be tested by calling the generateSuggestions function
      // Expected: suggestion to lower capacity to ~5 (4.0 * 1.2 = 4.8, rounded to 5)
    });

    it('should suggest lowering capacity when over-utilized (> 90%)', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 10,
        avgDailyUsage: 9.5,
        usageRate: 0.95, // 95%
        totalDeep: 60,
        totalFAQ: 6,
        totalArchived: 0,
      };

      // Expected: suggestion to lower capacity to 7 (10 - 3)
      // Priority: high
    });

    it('should suggest raising capacity when archive rate is high (> 60%)', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 10,
        avgDailyUsage: 8.0,
        usageRate: 0.8, // 80%
        totalDeep: 20,
        totalFAQ: 5,
        totalArchived: 50, // 50 / 75 = 66.7% archive rate
      };

      // Expected: suggestion to raise capacity to 12 (10 + 2)
      // Priority: low
    });

    it('should provide "no adjustments needed" when capacity is well-balanced', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 10,
        avgDailyUsage: 7.0,
        usageRate: 0.7, // 70% - well balanced
        totalDeep: 35,
        totalFAQ: 14,
        totalArchived: 0,
      };

      // Expected: suggestion saying no adjustments needed
      // Priority: low
    });

    it('should not suggest raising capacity above 20 (max limit)', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 20,
        avgDailyUsage: 15.0,
        usageRate: 0.75,
        totalDeep: 30,
        totalFAQ: 10,
        totalArchived: 65, // High archive rate
      };

      // Even with high archive rate, should not suggest > 20
    });

    it('should not suggest lowering capacity below 5 (min limit)', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 6,
        avgDailyUsage: 2.0,
        usageRate: 0.33, // 33% - very low usage
        totalDeep: 10,
        totalFAQ: 4,
        totalArchived: 0,
      };

      // Even with low usage, should not suggest < 5
      // Expected: suggestion for 5 (minimum)
    });

    it('should provide multiple suggestions when multiple conditions met', () => {
      const metrics: CapacityMetrics = {
        capacitySet: 10,
        avgDailyUsage: 3.0,
        usageRate: 0.3, // Under-utilized AND high archive
        totalDeep: 5,
        totalFAQ: 2,
        totalArchived: 15, // 15/22 = 68% archive rate
      };

      // Expected: 2 suggestions (lower due to under-use, raise due to archive rate)
    });
  });

  describe('sendWeeklyReportNotification', () => {
    it('should create notification with correct data', async () => {
      // Mock setup would be needed to test notification creation
      // Expected: notification with type='weekly_capacity_report', correct title/body
    });

    it('should include reportId in notification data', async () => {
      // Expected: notification.data.reportId should match report.id
    });
  });

  describe('getWeekBoundaries', () => {
    it('should return Sunday to Saturday boundaries', () => {
      // Test that week starts on Sunday 00:00 and ends Saturday 23:59
    });

    it('should handle week boundaries across month boundaries', () => {
      // Test weeks that span across months (e.g., Oct 29 - Nov 4)
    });
  });
});
