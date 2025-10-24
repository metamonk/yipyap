/**
 * Unit tests for opportunity scoring functionality (Story 5.6)
 */

import { scoreOpportunity, type OpportunityScoreResult, type OpportunityType } from '../../../api/utils/aiClient';

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'gpt-4-turbo'),
}));

import { generateText } from 'ai';

const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

describe('opportunityScoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreOpportunity', () => {
    it('should score a high-value sponsorship opportunity correctly', async () => {
      // Mock GPT-4 Turbo response
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          score: 95,
          type: 'sponsorship',
          indicators: ['brand sponsorship', 'budget discussion', 'compensation mentioned'],
          analysis: 'High-value brand sponsorship with clear budget and professional tone',
        }),
      } as any);

      const result = await scoreOpportunity(
        'Hi, I represent Nike and we would like to sponsor your content for $5000 per post',
        'test-api-key'
      );

      expect(result.score).toBe(95);
      expect(result.type).toBe('sponsorship');
      expect(result.indicators).toContain('brand sponsorship');
      expect(result.analysis).toContain('High-value');
    });

    it('should score a collaboration opportunity correctly', async () => {
      // Mock GPT-4 Turbo response
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          score: 70,
          type: 'collaboration',
          indicators: ['collaboration proposal', 'partnership'],
          analysis: 'Content collaboration opportunity with another creator',
        }),
      } as any);

      const result = await scoreOpportunity(
        'Would love to collaborate on a video project together',
        'test-api-key'
      );

      expect(result.score).toBe(70);
      expect(result.type).toBe('collaboration');
      expect(result.indicators).toContain('collaboration proposal');
    });

    it('should score a low-value sale opportunity', async () => {
      // Mock GPT-4 Turbo response
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          score: 30,
          type: 'sale',
          indicators: ['product inquiry'],
          analysis: 'Low-value product purchase inquiry',
        }),
      } as any);

      const result = await scoreOpportunity(
        'Can I buy your merch?',
        'test-api-key'
      );

      expect(result.score).toBe(30);
      expect(result.type).toBe('sale');
    });

    it('should fall back to rule-based scoring when AI fails', async () => {
      // Mock AI failure
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await scoreOpportunity(
        'I want to sponsor your channel with a $10,000 brand partnership deal',
        'test-api-key'
      );

      // Should return fallback result with reasonable score
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.type).toBeDefined();
      expect(result.indicators).toBeDefined();
      expect(result.analysis).toContain('rule-based');
    });

    it('should handle rule-based scoring for sponsorship keywords', async () => {
      // Mock AI failure to trigger fallback
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await scoreOpportunity(
        'We want to sponsor your content with our brand',
        'test-api-key'
      );

      // Rule-based scoring should detect sponsorship keywords
      expect(result.score).toBeGreaterThanOrEqual(40); // +40 for sponsorship keywords
      expect(result.type).toBe('sponsorship');
      expect(result.indicators).toContain('sponsorship keywords');
    });

    it('should handle rule-based scoring for budget mentions', async () => {
      // Mock AI failure to trigger fallback
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await scoreOpportunity(
        'Our budget for this collaboration is $5000',
        'test-api-key'
      );

      // Rule-based scoring should detect budget keywords
      expect(result.score).toBeGreaterThanOrEqual(30); // +30 for budget keywords
      expect(result.indicators).toContain('budget discussion');
    });

    it('should handle rule-based scoring for collaboration keywords', async () => {
      // Mock AI failure to trigger fallback
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await scoreOpportunity(
        'Let\'s collaborate and partner on this project',
        'test-api-key'
      );

      // Rule-based scoring should detect collaboration keywords
      expect(result.score).toBeGreaterThanOrEqual(20); // +20 for collaboration keywords
      expect(result.type).toBe('collaboration');
      expect(result.indicators).toContain('collaboration proposal');
    });

    it('should apply default score when no indicators found', async () => {
      // Mock AI failure to trigger fallback
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      const result = await scoreOpportunity(
        'Business inquiry',
        'test-api-key'
      );

      // Rule-based scoring should apply default score
      expect(result.score).toBe(50); // Default medium priority
      expect(result.indicators).toContain('business inquiry');
    });

    it('should retry on transient failures before falling back', async () => {
      // Mock first two attempts fail, third succeeds
      mockGenerateText
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          text: JSON.stringify({
            score: 85,
            type: 'partnership',
            indicators: ['long-term partnership'],
            analysis: 'Strategic partnership opportunity',
          }),
        } as any);

      const result = await scoreOpportunity(
        'Long-term partnership opportunity',
        'test-api-key'
      );

      expect(result.score).toBe(85);
      expect(result.type).toBe('partnership');
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
    });

    it('should validate score is within 0-100 range', async () => {
      // Mock GPT-4 Turbo response
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          score: 75,
          type: 'sponsorship',
          indicators: ['brand deal'],
          analysis: 'Brand sponsorship opportunity',
        }),
      } as any);

      const result = await scoreOpportunity(
        'Brand sponsorship opportunity',
        'test-api-key'
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle invalid JSON response gracefully', async () => {
      // Mock invalid JSON response
      mockGenerateText.mockResolvedValueOnce({
        text: 'This is not valid JSON',
      } as any);

      const result = await scoreOpportunity(
        'Sponsorship opportunity',
        'test-api-key'
      );

      // Should fall back to rule-based scoring
      expect(result.score).toBeGreaterThan(0);
      expect(result.analysis).toContain('rule-based');
    });

    it('should handle missing required fields in response', async () => {
      // Mock response missing required fields
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          score: 80,
          // Missing type, indicators, and analysis
        }),
      } as any);

      const result = await scoreOpportunity(
        'Partnership opportunity',
        'test-api-key'
      );

      // Should fall back to rule-based scoring
      expect(result.score).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.indicators).toBeDefined();
      expect(result.analysis).toBeDefined();
    });

    it('should cap rule-based scores at 100', async () => {
      // Mock AI failure to trigger fallback
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'));

      // Message with all possible keywords (should not exceed 100)
      const result = await scoreOpportunity(
        'We want to sponsor and partner in a long-term collaboration with significant budget and compensation for brand endorsement',
        'test-api-key'
      );

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
