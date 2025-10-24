/**
 * Unit tests for AI Cache Service
 */

import {
  generateCacheKey,
  getCachedResult,
  setCachedResult,
  isCachingEnabled,
} from '../../../services/aiCacheService';
import { getFirestore, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toMillis: () => Date.now(),
    })),
    fromMillis: jest.fn((ms) => ({
      toMillis: () => ms,
    })),
  },
}));

// Mock Firebase service
jest.mock('../../../services/firebase', () => ({
  getFirebaseApp: jest.fn(() => ({})),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;

describe('aiCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirestore.mockReturnValue({} as any);
    mockDoc.mockReturnValue({} as any);
    mockSetDoc.mockResolvedValue(undefined as any);
  });

  describe('generateCacheKey', () => {
    it('should generate deterministic cache keys', () => {
      const content = 'Hello world!';
      const operation = 'categorization';

      const key1 = generateCacheKey(content, operation);
      const key2 = generateCacheKey(content, operation);

      expect(key1).toBe(key2);
      expect(key1).toContain('categorization_');
    });

    it('should generate different keys for different content', () => {
      const operation = 'categorization';

      const key1 = generateCacheKey('Hello world!', operation);
      const key2 = generateCacheKey('Different message', operation);

      expect(key1).not.toBe(key2);
    });

    it('should include operation prefix in cache key', () => {
      const content = 'Test message';

      const catKey = generateCacheKey(content, 'categorization');
      const faqKey = generateCacheKey(content, 'faq_detection');

      expect(catKey).toContain('categorization_');
      expect(faqKey).toContain('faq_detection_');
      expect(catKey).not.toBe(faqKey);
    });

    it('should handle empty strings', () => {
      const key = generateCacheKey('', 'categorization');

      expect(key).toBeDefined();
      expect(key).toContain('categorization_');
    });

    it('should handle special characters', () => {
      const content = '🎉 Hello! @user #hashtag $price';
      const key = generateCacheKey(content, 'categorization');

      expect(key).toBeDefined();
      expect(key).toContain('categorization_');
    });
  });

  describe('isCachingEnabled', () => {
    it('should return true for operations with TTL > 0', () => {
      expect(isCachingEnabled('categorization')).toBe(true);
      expect(isCachingEnabled('sentiment')).toBe(true);
      expect(isCachingEnabled('faq_detection')).toBe(true);
      expect(isCachingEnabled('voice_matching')).toBe(true);
      expect(isCachingEnabled('opportunity_scoring')).toBe(true);
    });

    it('should return false for daily_agent operation (TTL = 0)', () => {
      expect(isCachingEnabled('daily_agent')).toBe(false);
    });
  });

  describe('getCachedResult', () => {
    it('should return cached result on cache hit', async () => {
      const cacheKey = 'categorization_abc123';
      const userId = 'user123';
      const cachedData = {
        category: 'fan_engagement',
        confidence: 0.95,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          key: cacheKey,
          operation: 'categorization',
          result: cachedData,
          cachedAt: Timestamp.now(),
          expiresAt: {
            toMillis: () => Date.now() + 60 * 60 * 1000, // Expires in 1 hour
          },
          hitCount: 5,
        }),
      } as any);

      const result = await getCachedResult(cacheKey, userId);

      expect(result).toEqual(cachedData);
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    it('should return null for cache miss (document does not exist)', async () => {
      const cacheKey = 'categorization_nonexistent';
      const userId = 'user123';

      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await getCachedResult(cacheKey, userId);

      expect(result).toBeNull();
    });

    it('should return null for expired cache entries', async () => {
      const cacheKey = 'categorization_expired';
      const userId = 'user123';

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          key: cacheKey,
          operation: 'categorization',
          result: { category: 'old_data' },
          cachedAt: Timestamp.now(),
          expiresAt: {
            toMillis: () => Date.now() - 1000, // Expired 1 second ago
          },
          hitCount: 10,
        }),
      } as any);

      const result = await getCachedResult(cacheKey, userId);

      expect(result).toBeNull();
    });

    it('should update hit count on cache hit', async () => {
      const cacheKey = 'categorization_hit';
      const userId = 'user123';
      const initialHitCount = 3;

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          key: cacheKey,
          operation: 'categorization',
          result: { category: 'test' },
          cachedAt: Timestamp.now(),
          expiresAt: {
            toMillis: () => Date.now() + 60 * 60 * 1000,
          },
          hitCount: initialHitCount,
        }),
      } as any);

      await getCachedResult(cacheKey, userId);

      // setDoc should be called to update hit count (fire-and-forget)
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          hitCount: initialHitCount + 1,
          lastHitAt: expect.anything(),
        }),
        { merge: true }
      );
    });

    it('should handle errors gracefully and return null', async () => {
      const cacheKey = 'categorization_error';
      const userId = 'user123';

      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await getCachedResult(cacheKey, userId);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('setCachedResult', () => {
    it('should store result in cache with operation-specific TTL', async () => {
      const cacheKey = 'categorization_new';
      const userId = 'user123';
      const operation = 'categorization';
      const result = { category: 'fan_engagement', confidence: 0.9 };

      await setCachedResult(cacheKey, userId, operation, result);

      // Allow time for async fire-and-forget
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          key: cacheKey,
          operation,
          result,
          cachedAt: expect.anything(),
          expiresAt: expect.anything(),
          hitCount: 0,
        })
      );
    });

    it('should not cache when TTL is 0 (daily_agent)', async () => {
      const cacheKey = 'daily_agent_test';
      const userId = 'user123';
      const operation = 'daily_agent';
      const result = { summary: 'test' };

      await setCachedResult(cacheKey, userId, operation, result);

      // Should not call setDoc for operations with TTL = 0
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should use custom TTL when provided', async () => {
      const cacheKey = 'custom_ttl';
      const userId = 'user123';
      const operation = 'categorization';
      const result = { test: 'data' };
      const customTTL = 5 * 60 * 1000; // 5 minutes

      await setCachedResult(cacheKey, userId, operation, result, customTTL);

      // Allow time for async fire-and-forget
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should not cache when custom TTL is 0', async () => {
      const cacheKey = 'zero_ttl';
      const userId = 'user123';
      const operation = 'categorization';
      const result = { test: 'data' };

      await setCachedResult(cacheKey, userId, operation, result, 0);

      // Should not call setDoc when TTL is 0
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully (fire-and-forget)', async () => {
      const cacheKey = 'error_test';
      const userId = 'user123';
      const operation = 'categorization';
      const result = { test: 'data' };

      mockSetDoc.mockRejectedValue(new Error('Firestore write error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw even if write fails
      await expect(
        setCachedResult(cacheKey, userId, operation, result)
      ).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should handle different operation types', async () => {
      const userId = 'user123';
      const operations: Array<
        'categorization' | 'sentiment' | 'faq_detection' | 'voice_matching' | 'opportunity_scoring' | 'daily_agent'
      > = ['categorization', 'sentiment', 'faq_detection', 'voice_matching', 'opportunity_scoring'];

      for (const operation of operations) {
        const cacheKey = `${operation}_test`;
        const result = { operation };

        await setCachedResult(cacheKey, userId, operation, result);
      }

      // Allow time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be called for all operations except daily_agent
      expect(mockSetDoc).toHaveBeenCalledTimes(operations.length);
    });
  });

  describe('Integration scenarios', () => {
    it('should successfully cache and retrieve result', async () => {
      const content = 'Test message for caching';
      const operation = 'categorization';
      const userId = 'user123';
      const result = { category: 'fan_engagement', confidence: 0.92 };

      // Generate cache key
      const cacheKey = generateCacheKey(content, operation);
      expect(cacheKey).toBeDefined();

      // Store in cache
      await setCachedResult(cacheKey, userId, operation, result);

      // Mock the retrieval
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          key: cacheKey,
          operation,
          result,
          cachedAt: Timestamp.now(),
          expiresAt: {
            toMillis: () => Date.now() + 24 * 60 * 60 * 1000,
          },
          hitCount: 0,
        }),
      } as any);

      // Retrieve from cache
      const retrieved = await getCachedResult(cacheKey, userId);

      expect(retrieved).toEqual(result);
    });

    it('should respect different TTLs for different operations', () => {
      // Categorization: 24 hours
      expect(isCachingEnabled('categorization')).toBe(true);

      // FAQ detection: 7 days
      expect(isCachingEnabled('faq_detection')).toBe(true);

      // Voice matching: 30 minutes
      expect(isCachingEnabled('voice_matching')).toBe(true);

      // Daily agent: never cache
      expect(isCachingEnabled('daily_agent')).toBe(false);
    });

    it('should handle cache expiration correctly', async () => {
      const cacheKey = 'expiration_test';
      const userId = 'user123';

      // First call: valid cache
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          key: cacheKey,
          operation: 'categorization',
          result: { valid: true },
          cachedAt: Timestamp.now(),
          expiresAt: {
            toMillis: () => Date.now() + 1000, // Expires in 1 second
          },
          hitCount: 0,
        }),
      } as any);

      const result1 = await getCachedResult(cacheKey, userId);
      expect(result1).toEqual({ valid: true });

      // Second call: expired cache
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          key: cacheKey,
          operation: 'categorization',
          result: { valid: true },
          cachedAt: Timestamp.now(),
          expiresAt: {
            toMillis: () => Date.now() - 1000, // Expired 1 second ago
          },
          hitCount: 1,
        }),
      } as any);

      const result2 = await getCachedResult(cacheKey, userId);
      expect(result2).toBeNull();
    });
  });
});
