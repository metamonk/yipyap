/**
 * Unit tests for cacheService (Story 5.7 - Task 10)
 * CRITICAL: Tests Timestamp serialization/deserialization
 */

// Mock firebase/firestore BEFORE imports
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    private date: Date;

    constructor(seconds: number, nanoseconds: number) {
      this.date = new Date(seconds * 1000 + nanoseconds / 1000000);
    }

    toDate(): Date {
      return this.date;
    }

    toMillis(): number {
      return this.date.getTime();
    }

    static fromDate(date: Date): MockTimestamp {
      const seconds = Math.floor(date.getTime() / 1000);
      const nanoseconds = (date.getTime() % 1000) * 1000000;
      return new MockTimestamp(seconds, nanoseconds);
    }

    static fromMillis(millis: number): MockTimestamp {
      return MockTimestamp.fromDate(new Date(millis));
    }

    static now(): MockTimestamp {
      return MockTimestamp.fromDate(new Date());
    }
  }

  return {
    Timestamp: MockTimestamp,
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';
import {
  serializeDashboardSummary,
  deserializeDashboardSummary,
  cacheDashboardSummary,
  getCachedDashboardSummary,
  cacheOpportunities,
  getCachedOpportunities,
  clearCache,
} from '@/services/cacheService';
import type { DashboardSummary } from '@/types/dashboard';
import type { Message } from '@/types/models';

describe('cacheService', () => {
  const mockUserId = 'test-user-123';

  // Mock data
  const mockDashboardSummary: DashboardSummary = {
    userId: mockUserId,
    period: 'overnight',
    periodStart: Timestamp.fromDate(new Date('2025-10-23T22:00:00Z')),
    periodEnd: Timestamp.fromDate(new Date('2025-10-24T08:00:00Z')),
    messagingMetrics: {
      totalMessages: 42,
      byCategory: {
        fan_engagement: 15,
        business_opportunity: 5,
        spam: 2,
        urgent: 3,
        general: 17,
      },
      highValueOpportunities: 3,
      crisisMessages: 1,
    },
    sentimentMetrics: {
      positiveCount: 25,
      negativeCount: 5,
      neutralCount: 10,
      mixedCount: 2,
      averageSentimentScore: 0.65,
      crisisDetections: 1,
    },
    faqMetrics: {
      newQuestionsDetected: 2,
      autoResponsesSent: 5,
      faqMatchRate: 11.9,
    },
    voiceMatchingMetrics: {
      suggestionsGenerated: 8,
      suggestionsAccepted: 6,
      suggestionsEdited: 1,
      suggestionsRejected: 1,
      acceptanceRate: 75.0,
    },
    comparisonWithPrevious: {
      messageCountChange: 15.5,
      opportunityCountChange: 50.0,
      sentimentScoreChange: 0.1,
    },
    lastUpdated: Timestamp.now(),
  };

  const mockOpportunities: Message[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-2',
      text: 'Would love to collaborate on a project!',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.fromDate(new Date('2025-10-24T10:00:00Z')),
      metadata: {
        category: 'business_opportunity',
        categoryConfidence: 0.92,
        opportunityScore: 85,
        opportunityType: 'collaboration',
        aiProcessed: true,
      },
    },
    {
      id: 'msg-2',
      conversationId: 'conv-2',
      senderId: 'user-3',
      text: 'Interested in sponsoring your content',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.fromDate(new Date('2025-10-24T09:30:00Z')),
      metadata: {
        category: 'business_opportunity',
        categoryConfidence: 0.95,
        opportunityScore: 90,
        opportunityType: 'sponsorship',
        aiProcessed: true,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard Summary Serialization', () => {
    it('should serialize DashboardSummary with Timestamp conversion', () => {
      const serialized = serializeDashboardSummary(mockDashboardSummary);
      const parsed = JSON.parse(serialized);

      // Verify Timestamps are converted to ISO strings
      expect(typeof parsed.periodStart).toBe('string');
      expect(typeof parsed.periodEnd).toBe('string');
      expect(typeof parsed.lastUpdated).toBe('string');

      // Verify ISO string format
      expect(parsed.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(parsed.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify other data is preserved
      expect(parsed.userId).toBe(mockUserId);
      expect(parsed.messagingMetrics.totalMessages).toBe(42);
      expect(parsed.sentimentMetrics.averageSentimentScore).toBe(0.65);
    });

    it('should deserialize DashboardSummary with Timestamp restoration', () => {
      const serialized = serializeDashboardSummary(mockDashboardSummary);
      const deserialized = deserializeDashboardSummary(serialized);

      // Verify Timestamps are restored
      expect(deserialized.periodStart).toBeInstanceOf(Timestamp);
      expect(deserialized.periodEnd).toBeInstanceOf(Timestamp);
      expect(deserialized.lastUpdated).toBeInstanceOf(Timestamp);

      // Verify timestamp values match original
      expect(deserialized.periodStart.toMillis()).toBe(
        mockDashboardSummary.periodStart.toMillis()
      );
      expect(deserialized.periodEnd.toMillis()).toBe(
        mockDashboardSummary.periodEnd.toMillis()
      );

      // Verify other data is preserved
      expect(deserialized.userId).toBe(mockUserId);
      expect(deserialized.messagingMetrics.totalMessages).toBe(42);
      expect(deserialized.sentimentMetrics.averageSentimentScore).toBe(0.65);
    });

    it('should handle round-trip serialization/deserialization', () => {
      const serialized = serializeDashboardSummary(mockDashboardSummary);
      const deserialized = deserializeDashboardSummary(serialized);
      const reSerialized = serializeDashboardSummary(deserialized);

      // Second serialization should match first
      expect(reSerialized).toBe(serialized);
    });
  });

  describe('cacheDashboardSummary', () => {
    it('should cache dashboard summary to AsyncStorage', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await cacheDashboardSummary(mockUserId, mockDashboardSummary);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `dashboard_summary_${mockUserId}`,
        expect.any(String)
      );

      // Verify serialized data structure
      const serializedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(serializedData);
      expect(typeof parsed.periodStart).toBe('string');
      expect(typeof parsed.lastUpdated).toBe('string');
    });

    it('should not throw on AsyncStorage errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      // Should not throw
      await expect(cacheDashboardSummary(mockUserId, mockDashboardSummary)).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to cache dashboard summary:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCachedDashboardSummary', () => {
    it('should retrieve cached dashboard summary', async () => {
      const serialized = serializeDashboardSummary(mockDashboardSummary);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(serialized);

      const result = await getCachedDashboardSummary(mockUserId);

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`dashboard_summary_${mockUserId}`);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(mockUserId);
      expect(result?.periodStart).toBeInstanceOf(Timestamp);
      expect(result?.messagingMetrics.totalMessages).toBe(42);
    });

    it('should return null if no cache exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getCachedDashboardSummary(mockUserId);

      expect(result).toBeNull();
    });

    it('should return null and remove expired cache (>5 minutes old)', async () => {
      // Create summary with old timestamp (6 minutes ago)
      const oldSummary = {
        ...mockDashboardSummary,
        lastUpdated: Timestamp.fromMillis(Date.now() - 6 * 60 * 1000),
      };
      const serialized = serializeDashboardSummary(oldSummary);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(serialized);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await getCachedDashboardSummary(mockUserId);

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`dashboard_summary_${mockUserId}`);
    });

    it('should return cached data if within TTL (5 minutes)', async () => {
      // Create summary with recent timestamp (3 minutes ago)
      const recentSummary = {
        ...mockDashboardSummary,
        lastUpdated: Timestamp.fromMillis(Date.now() - 3 * 60 * 1000),
      };
      const serialized = serializeDashboardSummary(recentSummary);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(serialized);

      const result = await getCachedDashboardSummary(mockUserId);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(mockUserId);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should return null on deserialization errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const result = await getCachedDashboardSummary(mockUserId);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to get cached dashboard summary:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Opportunities Caching', () => {
    it('should cache opportunities with Timestamp serialization', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await cacheOpportunities(mockUserId, mockOpportunities);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `opportunities_${mockUserId}`,
        expect.any(String)
      );

      // Verify serialized structure
      const serializedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(serializedData);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(typeof parsed[0].timestamp).toBe('string');
      expect(parsed[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should retrieve cached opportunities with Timestamp restoration', async () => {
      const serialized = mockOpportunities.map((opp) => ({
        ...opp,
        timestamp: opp.timestamp.toDate().toISOString(),
      }));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(serialized));

      const result = await getCachedOpportunities(mockUserId);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(2);
      expect(result?.[0].timestamp).toBeInstanceOf(Timestamp);
      expect(result?.[0].id).toBe('msg-1');
      expect(result?.[0].metadata?.opportunityScore).toBe(85);
    });

    it('should return null if no cached opportunities', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getCachedOpportunities(mockUserId);

      expect(result).toBeNull();
    });

    it('should not throw on caching errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(cacheOpportunities(mockUserId, mockOpportunities)).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to cache opportunities:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return null on retrieval errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await getCachedOpportunities(mockUserId);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to get cached opportunities:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data for user', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await clearCache(mockUserId);

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`dashboard_summary_${mockUserId}`);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`opportunities_${mockUserId}`);
    });

    it('should not throw on clear errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(clearCache(mockUserId)).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to clear cache:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cache Performance', () => {
    it('should serialize dashboard summary quickly (<10ms)', () => {
      const startTime = Date.now();
      serializeDashboardSummary(mockDashboardSummary);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    it('should deserialize dashboard summary quickly (<10ms)', () => {
      const serialized = serializeDashboardSummary(mockDashboardSummary);
      const startTime = Date.now();
      deserializeDashboardSummary(serialized);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });
  });
});
