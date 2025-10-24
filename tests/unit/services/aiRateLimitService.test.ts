/**
 * Unit tests for AI Rate Limiting Service
 * @module tests/unit/services/aiRateLimitService
 */

import {
  checkRateLimit,
  incrementOperationCount,
  getRateLimitStatus,
  cleanupExpiredRateLimits,
  type RateLimitOperation,
} from '@/services/aiRateLimitService';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({ name: 'test-app' })),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
}));

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;

describe('aiRateLimitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock returns
    mockGetFirestore.mockReturnValue({} as any);
    mockDoc.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
  });

  describe('checkRateLimit', () => {
    it('should allow operation when under limits', async () => {
      // Mock Firestore to return counts under limits
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 10 }),
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.status.hourlyCount).toBe(10);
      expect(result.status.dailyCount).toBe(10);
      expect(result.status.hourlyLimitReached).toBe(false);
      expect(result.status.dailyLimitReached).toBe(false);
    });

    it('should block operation when hourly limit reached', async () => {
      // Mock Firestore to return counts at hourly limit
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 200 }), // Hourly limit for categorization
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 500 }), // Daily count
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('hourly_limit');
      expect(result.status.hourlyLimitReached).toBe(true);
      expect(result.status.dailyLimitReached).toBe(false);
      expect(result.status.message).toContain('hourly limit');
      expect(result.status.message).toContain('200 requests/hour');
    });

    it('should block operation when daily limit reached', async () => {
      // Mock Firestore to return counts at daily limit (hourly under limit)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 50 }), // Hourly count (under limit of 200)
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 2000 }), // Daily limit for categorization
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit');
      expect(result.status.hourlyLimitReached).toBe(false);
      expect(result.status.dailyLimitReached).toBe(true);
      expect(result.status.message).toContain('daily');
    });

    it('should return 0 counts when documents do not exist', async () => {
      // Mock Firestore to return non-existent documents
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.allowed).toBe(true);
      expect(result.status.hourlyCount).toBe(0);
      expect(result.status.dailyCount).toBe(0);
    });

    it('should handle voice_matching limits correctly', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 50 }), // At hourly limit for voice_matching
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 200 }), // Daily count
      });

      const result = await checkRateLimit('user123', 'voice_matching');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('hourly_limit');
      expect(result.status.hourlyLimit).toBe(50);
      expect(result.status.dailyLimit).toBe(500);
    });

    it('should handle daily_agent limits correctly', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 2 }), // At hourly limit for daily_agent
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 2 }), // At daily limit
      });

      const result = await checkRateLimit('user123', 'daily_agent');

      expect(result.allowed).toBe(false);
      expect(result.status.hourlyLimit).toBe(2);
      expect(result.status.dailyLimit).toBe(2);
    });

    it('should allow operation on error (fail-open)', async () => {
      // Mock Firestore to throw error
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await checkRateLimit('user123', 'categorization');

      // Should default to allowed on error to avoid blocking users
      // When getDoc fails, getWindowCount catches the error and returns 0
      // So checkRateLimit proceeds with 0 counts (graceful degradation)
      expect(result.allowed).toBe(true);
      expect(result.status.hourlyCount).toBe(0);
      expect(result.status.dailyCount).toBe(0);
    });

    it('should include reset times in status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 10 }),
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.status.hourlyResetAt).toBeInstanceOf(Date);
      expect(result.status.dailyResetAt).toBeInstanceOf(Date);
      expect(result.status.dailyResetAt.getTime()).toBeGreaterThan(result.status.hourlyResetAt.getTime());
    });
  });

  describe('incrementOperationCount', () => {
    it('should create new documents when they do not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await incrementOperationCount('user123', 'categorization');

      expect(mockSetDoc).toHaveBeenCalledTimes(2); // Once for hourly, once for daily
      // When creating new documents, only 2 args (no merge option)
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          count: 1,
        })
      );
    });

    it('should increment existing documents', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 5 }),
      });

      await incrementOperationCount('user123', 'categorization');

      // Both hourly and daily documents should be updated
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });

    it('should not throw on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      // Should not throw
      await expect(
        incrementOperationCount('user123', 'categorization')
      ).resolves.not.toThrow();
    });

    it('should handle all operation types', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const operations: RateLimitOperation[] = [
        'categorization',
        'sentiment',
        'faq_detection',
        'voice_matching',
        'opportunity_scoring',
        'daily_agent',
      ];

      for (const operation of operations) {
        mockSetDoc.mockClear();
        await incrementOperationCount('user123', operation);
        expect(mockSetDoc).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current status without incrementing', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 50 }),
      });

      const status = await getRateLimitStatus('user123', 'categorization');

      expect(status.operation).toBe('categorization');
      expect(status.hourlyCount).toBe(50);
      expect(status.dailyCount).toBe(50);
      expect(mockSetDoc).not.toHaveBeenCalled(); // Should not increment
    });

    it('should return status for different operations', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 10 }),
      });

      const status = await getRateLimitStatus('user123', 'voice_matching');

      expect(status.operation).toBe('voice_matching');
      expect(status.hourlyLimit).toBe(50);
      expect(status.dailyLimit).toBe(500);
    });
  });

  describe('cleanupExpiredRateLimits', () => {
    it('should delete expired documents', async () => {
      const mockDocs = [
        { ref: { id: 'doc1' } },
        { ref: { id: 'doc2' } },
        { ref: { id: 'doc3' } },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockDocs,
      });

      await cleanupExpiredRateLimits();

      expect(mockDeleteDoc).toHaveBeenCalledTimes(3);
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: 'doc1' });
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: 'doc2' });
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: 'doc3' });
    });

    it('should handle no expired documents', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
      });

      await cleanupExpiredRateLimits();

      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('should not throw on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      // Should not throw
      await expect(cleanupExpiredRateLimits()).resolves.not.toThrow();
    });
  });

  describe('Rate limit calculations', () => {
    it('should calculate correct reset time for hourly limit', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 199 }), // Just under hourly limit
      });

      const now = new Date();
      const result = await checkRateLimit('user123', 'categorization');

      const resetTime = result.status.hourlyResetAt;
      const expectedResetHour = (now.getHours() + 1) % 24;

      expect(resetTime.getHours()).toBe(expectedResetHour);
      expect(resetTime.getMinutes()).toBe(0);
      expect(resetTime.getSeconds()).toBe(0);
    });

    it('should calculate correct reset time for daily limit', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ count: 1999 }), // Just under daily limit
      });

      const result = await checkRateLimit('user123', 'categorization');

      const resetTime = result.status.dailyResetAt;

      expect(resetTime.getHours()).toBe(0);
      expect(resetTime.getMinutes()).toBe(0);
      expect(resetTime.getSeconds()).toBe(0);
    });
  });

  describe('Error messages', () => {
    it('should provide user-friendly message for hourly limit', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 200 }),
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 500 }),
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.status.message).toBeDefined();
      expect(result.status.message).toContain('minute');
      expect(result.status.message).toContain('200');
    });

    it('should provide user-friendly message for daily limit', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 50 }), // Under hourly limit
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ count: 2000 }), // At daily limit
      });

      const result = await checkRateLimit('user123', 'categorization');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit');
      expect(result.status.message).toBeDefined();
      expect(result.status.message).toContain('daily');
    });
  });

  describe('Warning Notifications (Task 10.7)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockGetFirestore.mockReturnValue({} as any);
      mockDoc.mockReturnValue({} as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockReset();
      // Reset Notifications mock
      const notificationMock = Notifications.scheduleNotificationAsync as jest.Mock;
      notificationMock.mockClear();
      notificationMock.mockResolvedValue('notification-id');
    });

    it('should send warning notification when reaching 80% of daily limit', async () => {
      const dailyLimit = 2000; // categorization daily limit
      const countAt80Percent = Math.floor(dailyLimit * 0.8) - 1; // 1599 (before increment)

      // incrementWindowCount calls for hourly and daily
      // For hourly: doc exists with count 50, will increment to 51 (26% - not 80% of 200, so no warning check)
      // For daily: doc exists with count 1599, will increment to 1600 (80% of 2000)
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: 50 }), // Hourly: 50
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: countAt80Percent }), // Daily: 1599
        })
        // Hourly is only 26%, so no warning check for hourly
        // Check if warning should be sent for daily (yes, 1600/2000 = 80%)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: countAt80Percent + 1, warningNotificationSent: false }), // 1600
        });

      mockSetDoc.mockResolvedValue(undefined);

      await incrementOperationCount('user123', 'categorization');

      // Verify notification was scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      const notificationCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(notificationCall.content.body).toContain('80%');
      expect(notificationCall.content.body).toContain('daily');
    });

    it('should send warning notification when reaching 80% of hourly limit', async () => {
      const hourlyLimit = 200; // categorization hourly limit
      const countAt80Percent = Math.floor(hourlyLimit * 0.8) - 1; // 159 (before increment)

      // incrementWindowCount calls for hourly and daily
      // For hourly: doc exists with count 159, will increment to 160 (80%)
      // For daily: doc exists with count 100, will increment to 101 (not 80%)
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: countAt80Percent }), // Hourly: 159
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: 100 }), // Daily: 100 (not at 80%)
        })
        // After increment, check if warning should be sent for hourly
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: countAt80Percent + 1, warningNotificationSent: false }), // 160
        })
        // Check if warning should be sent for daily (no, because only 101/2000 = 5%)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: 101, warningNotificationSent: false }),
        });

      mockSetDoc.mockResolvedValue(undefined);

      await incrementOperationCount('user123', 'categorization');

      // Verify notification was scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      const notificationCall = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(notificationCall.content.title).toContain('AI Usage Warning');
      expect(notificationCall.content.body).toContain('80%');
      expect(notificationCall.content.body).toContain('hourly');
    });

    it('should not send duplicate warnings for same window', async () => {
      const hourlyLimit = 200;
      const countAt85Percent = Math.floor(hourlyLimit * 0.85); // 170

      // Mock that warning was already sent for this window
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: countAt85Percent, warningNotificationSent: true }), // Already sent
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: 200, warningNotificationSent: false }),
        });

      mockSetDoc.mockResolvedValue(undefined);

      await incrementOperationCount('user123', 'categorization');

      // Should not send notification because warningNotificationSent is true
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should not send warning when below 80% threshold', async () => {
      const hourlyLimit = 200;
      const countAt70Percent = Math.floor(hourlyLimit * 0.7); // 140

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => false,
        });

      mockSetDoc.mockResolvedValue(undefined);

      await incrementOperationCount('user123', 'categorization');

      // Should not send notification because under 80%
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      const hourlyLimit = 200;
      const countAt80Percent = Math.floor(hourlyLimit * 0.8);

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: countAt80Percent, warningNotificationSent: false }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: 200, warningNotificationSent: false }),
        });

      mockSetDoc.mockResolvedValue(undefined);

      // Mock notification to fail
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Notification failed')
      );

      // Should not throw - errors are caught and logged
      await expect(incrementOperationCount('user123', 'categorization')).resolves.not.toThrow();
    });

    it('should not send warning at 100% (limit reached)', async () => {
      const hourlyLimit = 200;

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => false,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: hourlyLimit, warningNotificationSent: false }), // Exactly at limit
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ count: 500, warningNotificationSent: false }),
        });

      mockSetDoc.mockResolvedValue(undefined);

      await incrementOperationCount('user123', 'categorization');

      // Should not send warning at 100% (only between 80-99%)
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
