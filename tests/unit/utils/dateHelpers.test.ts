/**
 * Unit tests for date helper utility functions
 */

import { Timestamp } from 'firebase/firestore';
import {
  formatRelativeTime,
  formatMessageTime,
  formatDateSeparator,
  shouldShowDateSeparator,
  formatMessageTimestamp,
} from '@/utils/dateHelpers';

// Mock Firebase Timestamp
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
    fromMillis: jest.fn((millis: number) => ({
      seconds: millis / 1000,
      nanoseconds: 0,
      toDate: () => new Date(millis),
    })),
  },
}));

describe('dateHelpers', () => {
  describe('formatRelativeTime', () => {
    it('returns "Just now" for timestamps less than 1 minute old', () => {
      const now = Timestamp.now();
      const result = formatRelativeTime(now);
      expect(result).toBe('Just now');
    });

    it('returns "Xm ago" for timestamps less than 1 hour old', () => {
      // 5 minutes ago
      const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinutesAgo);
      expect(result).toBe('5m ago');
    });

    it('returns "Xh ago" for timestamps less than 24 hours old', () => {
      // 3 hours ago
      const threeHoursAgo = Timestamp.fromMillis(Date.now() - 3 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeHoursAgo);
      expect(result).toBe('3h ago');
    });

    it('returns "Yesterday" for timestamps exactly 1 day old', () => {
      // 24 hours ago (1 day)
      const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(yesterday);
      expect(result).toBe('Yesterday');
    });

    it('returns day name for timestamps less than 7 days old', () => {
      // 3 days ago
      const threeDaysAgo = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeDaysAgo);
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      // Result should be one of the day names
      expect(dayNames).toContain(result);
    });

    it('returns "Mon DD" format for timestamps 7+ days old', () => {
      // 30 days ago
      const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(thirtyDaysAgo);

      // Should match pattern like "Jan 15" or "Dec 5"
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const hasMonthAbbreviation = months.some((month) => result.startsWith(month));

      expect(hasMonthAbbreviation).toBe(true);
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('returns consistent format for timestamps far in the past', () => {
      // 1 year ago
      const oneYearAgo = Timestamp.fromMillis(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(oneYearAgo);

      // Should match pattern like "Jan 15"
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('handles edge case of exactly 59 seconds ago', () => {
      const fiftyNineSecondsAgo = Timestamp.fromMillis(Date.now() - 59 * 1000);
      const result = formatRelativeTime(fiftyNineSecondsAgo);
      expect(result).toBe('Just now');
    });

    it('handles edge case of exactly 60 seconds ago', () => {
      const sixtySecondsAgo = Timestamp.fromMillis(Date.now() - 60 * 1000);
      const result = formatRelativeTime(sixtySecondsAgo);
      expect(result).toBe('1m ago');
    });

    it('handles edge case of exactly 59 minutes ago', () => {
      const fiftyNineMinutesAgo = Timestamp.fromMillis(Date.now() - 59 * 60 * 1000);
      const result = formatRelativeTime(fiftyNineMinutesAgo);
      expect(result).toBe('59m ago');
    });

    it('handles edge case of exactly 60 minutes ago', () => {
      const sixtyMinutesAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
      const result = formatRelativeTime(sixtyMinutesAgo);
      expect(result).toBe('1h ago');
    });
  });

  describe('formatDateSeparator', () => {
    it('returns "Today" for current date', () => {
      const today = Timestamp.now();
      expect(formatDateSeparator(today)).toBe('Today');
    });

    it('returns "Yesterday" for previous day', () => {
      const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      expect(formatDateSeparator(yesterday)).toBe('Yesterday');
    });

    it('returns day name for last 7 days', () => {
      const threeDaysAgo = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const expectedDay = dayNames[threeDaysAgo.toDate().getDay()];
      expect(formatDateSeparator(threeDaysAgo)).toBe(expectedDay);
    });

    it('returns "Month Day, Year" for older dates', () => {
      // Create a specific date using UTC to avoid timezone issues
      const oldDate = new Date(Date.UTC(2024, 0, 15)); // January 15, 2024 UTC
      const timestamp = {
        toDate: () => oldDate,
        seconds: oldDate.getTime() / 1000,
        nanoseconds: 0,
        toMillis: () => oldDate.getTime(),
      } as Timestamp;
      expect(formatDateSeparator(timestamp)).toBe('Jan 15, 2024');
    });

    it('handles null timestamp gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(formatDateSeparator(null as any)).toBe('Today');
    });

    it('handles invalid timestamp gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidTimestamp = { invalid: true } as any;
      expect(formatDateSeparator(invalidTimestamp)).toBe('Today');
    });
  });

  describe('shouldShowDateSeparator', () => {
    it('returns true for first message (null previous)', () => {
      const msg = Timestamp.now();
      expect(shouldShowDateSeparator(msg, null)).toBe(true);
    });

    it('returns false for messages on same day', () => {
      const msg1 = Timestamp.fromMillis(new Date('2025-01-15 10:00').getTime());
      const msg2 = Timestamp.fromMillis(new Date('2025-01-15 14:00').getTime());
      expect(shouldShowDateSeparator(msg2, msg1)).toBe(false);
    });

    it('returns true for messages on different days', () => {
      const msg1 = Timestamp.fromMillis(new Date('2025-01-15 23:00').getTime());
      const msg2 = Timestamp.fromMillis(new Date('2025-01-16 01:00').getTime());
      expect(shouldShowDateSeparator(msg2, msg1)).toBe(true);
    });

    it('handles midnight edge case correctly', () => {
      const beforeMidnight = Timestamp.fromMillis(new Date('2025-01-15 23:59:59').getTime());
      const afterMidnight = Timestamp.fromMillis(new Date('2025-01-16 00:00:01').getTime());
      expect(shouldShowDateSeparator(afterMidnight, beforeMidnight)).toBe(true);
    });
  });

  describe('formatMessageTimestamp', () => {
    it('returns time in 12-hour format', () => {
      const timestamp = Timestamp.fromMillis(new Date('2025-01-15 14:30:00').getTime());
      expect(formatMessageTimestamp(timestamp)).toBe('2:30 PM');
    });

    it('handles morning times', () => {
      const timestamp = Timestamp.fromMillis(new Date('2025-01-15 09:15:00').getTime());
      expect(formatMessageTimestamp(timestamp)).toBe('9:15 AM');
    });

    it('handles midnight correctly', () => {
      const timestamp = Timestamp.fromMillis(new Date('2025-01-15 00:00:00').getTime());
      expect(formatMessageTimestamp(timestamp)).toBe('12:00 AM');
    });

    it('handles noon correctly', () => {
      const timestamp = Timestamp.fromMillis(new Date('2025-01-15 12:00:00').getTime());
      expect(formatMessageTimestamp(timestamp)).toBe('12:00 PM');
    });

    it('handles null timestamp gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(formatMessageTimestamp(null as any)).toBe('Now');
    });

    it('handles invalid timestamp gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidTimestamp = { invalid: true } as any;
      expect(formatMessageTimestamp(invalidTimestamp)).toBe('Now');
    });
  });

  describe('formatMessageTime', () => {
    it('returns time only for today', () => {
      const now = Timestamp.now();
      const result = formatMessageTime(now);
      expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('returns "Yesterday" prefix for yesterday', () => {
      const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const result = formatMessageTime(yesterday);
      expect(result).toMatch(/^Yesterday \d{1,2}:\d{2} (AM|PM)$/);
    });

    it('returns date and time for older messages', () => {
      const oldDate = Timestamp.fromMillis(new Date('2024-01-15 10:30:00').getTime());
      const result = formatMessageTime(oldDate);
      expect(result).toBe('Jan 15, 10:30 AM');
    });
  });
});
