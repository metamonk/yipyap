/**
 * Unit tests for capacity service (Story 6.3)
 * Tests capacity suggestion, distribution preview, and time calculations
 */

import {
  suggestCapacity,
  calculateTimeCommitment,
  previewDistribution,
} from '@/services/capacityService';
import { MIN_CAPACITY, MAX_CAPACITY } from '@/types/user';

describe('capacityService', () => {
  describe('suggestCapacity', () => {
    it('should suggest 5 for 30 messages/day (low volume)', () => {
      const result = suggestCapacity(30);
      expect(result).toBe(5); // 30 * 0.18 = 5.4, rounded to 5
    });

    it('should suggest 14 for 80 messages/day (medium volume)', () => {
      const result = suggestCapacity(80);
      expect(result).toBe(14); // 80 * 0.18 = 14.4, rounded to 14
    });

    it('should suggest 10 for 56 messages/day', () => {
      const result = suggestCapacity(56);
      expect(result).toBe(10); // 56 * 0.18 = 10.08, rounded to 10
    });

    it('should cap at MAX_CAPACITY for 200 messages/day (high volume)', () => {
      const result = suggestCapacity(200);
      expect(result).toBe(MAX_CAPACITY); // 200 * 0.18 = 36, capped to 20
    });

    it('should return MIN_CAPACITY for 10 messages/day (very low volume)', () => {
      const result = suggestCapacity(10);
      expect(result).toBe(MIN_CAPACITY); // 10 * 0.18 = 1.8, floored to 5
    });

    it('should return MIN_CAPACITY for 0 messages/day (no messages)', () => {
      const result = suggestCapacity(0);
      expect(result).toBe(MIN_CAPACITY); // 0 * 0.18 = 0, floored to 5
    });
  });

  describe('calculateTimeCommitment', () => {
    it('should calculate 20 minutes for capacity of 10', () => {
      const result = calculateTimeCommitment(10);
      expect(result).toBe(20); // 10 * 2 minutes
    });

    it('should calculate 30 minutes for capacity of 15', () => {
      const result = calculateTimeCommitment(15);
      expect(result).toBe(30); // 15 * 2 minutes
    });

    it('should calculate 40 minutes for capacity of 20', () => {
      const result = calculateTimeCommitment(20);
      expect(result).toBe(40); // 20 * 2 minutes
    });

    it('should calculate 10 minutes for capacity of 5', () => {
      const result = calculateTimeCommitment(5);
      expect(result).toBe(10); // 5 * 2 minutes
    });
  });

  describe('previewDistribution', () => {
    it('should correctly distribute with 15% FAQ rate', () => {
      const result = previewDistribution(10, 50, 0.15);

      expect(result.deep).toBe(10); // Capacity limit
      expect(result.faq).toBe(8); // 50 * 0.15 = 7.5, rounded to 8
      expect(result.archived).toBe(32); // 50 - 10 - 8 = 32
    });

    it('should handle high capacity (20 messages)', () => {
      const result = previewDistribution(20, 100, 0.15);

      expect(result.deep).toBe(20); // Capacity limit
      expect(result.faq).toBe(15); // 100 * 0.15 = 15
      expect(result.archived).toBe(65); // 100 - 20 - 15 = 65
    });

    it('should handle low capacity (5 messages)', () => {
      const result = previewDistribution(5, 30, 0.15);

      expect(result.deep).toBe(5); // Capacity limit
      expect(result.faq).toBe(5); // 30 * 0.15 = 4.5, rounded to 5
      expect(result.archived).toBe(20); // 30 - 5 - 5 = 20
    });

    it('should return 0 archived when capacity + FAQ equals total messages', () => {
      const result = previewDistribution(15, 20, 0.25);

      expect(result.deep).toBe(15);
      expect(result.faq).toBe(5); // 20 * 0.25 = 5
      expect(result.archived).toBe(0); // 20 - 15 - 5 = 0
    });

    it('should return 0 archived when no messages exist', () => {
      const result = previewDistribution(10, 0, 0.15);

      expect(result.deep).toBe(10);
      expect(result.faq).toBe(0); // 0 * 0.15 = 0
      expect(result.archived).toBe(0); // Max(0, 0 - 10 - 0) = 0
    });

    it('should use default FAQ rate of 15% when not provided', () => {
      const result = previewDistribution(10, 50);

      expect(result.faq).toBe(8); // 50 * 0.15 = 7.5, rounded to 8
    });
  });
});
