/**
 * Unit tests for categorization and opportunity scoring (Story 6.8)
 *
 * Tests the new local AI functions with proper OpenAI SDK mocking
 */

import { categorizeMessage } from '../../../src/ai/categorization';
import { scoreOpportunity } from '../../../src/ai/opportunity-scoring';
import OpenAI from 'openai';

// Mock the OpenAI SDK
jest.mock('openai');

describe('AI Functions Unit Tests', () => {
  const mockApiKey = 'test-api-key';
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup OpenAI mock
    mockCreate = jest.fn();
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        } as any)
    );
  });

  describe('categorizeMessage', () => {
    it('should categorize fan engagement message correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'fan_engagement',
                confidence: 0.95,
                reasoning: 'Positive appreciation message from a fan',
                sentiment: 'positive',
                sentimentScore: 0.85,
                emotionalTone: ['excited', 'grateful'],
                sentimentReasoning: 'Enthusiastic and appreciative tone',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage('Love your content! Keep it up!', mockApiKey);

      expect(result.category).toBe('fan_engagement');
      expect(result.confidence).toBe(0.95);
      expect(result.sentiment).toBe('positive');
      expect(result.sentimentScore).toBe(0.85);
      expect(result.crisisDetected).toBe(false);
      expect(result.emotionalTone).toEqual(['excited', 'grateful']);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.3,
        })
      );
    });

    it('should categorize business opportunity message correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'business_opportunity',
                confidence: 0.92,
                reasoning: 'Sponsorship inquiry with clear business intent',
                sentiment: 'neutral',
                sentimentScore: 0.1,
                emotionalTone: ['professional', 'interested'],
                sentimentReasoning: 'Formal business communication',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage(
        'Hi, we would like to discuss a sponsorship opportunity with you.',
        mockApiKey
      );

      expect(result.category).toBe('business_opportunity');
      expect(result.confidence).toBe(0.92);
      expect(result.sentiment).toBe('neutral');
      expect(result.crisisDetected).toBe(false);
    });

    it('should categorize spam message correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'spam',
                confidence: 0.98,
                reasoning: 'Promotional content with suspicious link',
                sentiment: 'neutral',
                sentimentScore: 0.0,
                emotionalTone: ['promotional'],
                sentimentReasoning: 'Generic promotional tone',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage('Click here to win $1000! Limited time offer!', mockApiKey);

      expect(result.category).toBe('spam');
      expect(result.confidence).toBe(0.98);
    });

    it('should detect crisis when sentimentScore < -0.7', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'urgent',
                confidence: 0.95,
                reasoning: 'Self-harm indicators detected',
                sentiment: 'negative',
                sentimentScore: -0.9,
                emotionalTone: ['hopeless', 'desperate'],
                sentimentReasoning: 'Severe emotional distress',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage(
        'I feel hopeless and worthless. I cannot go on anymore.',
        mockApiKey
      );

      expect(result.crisisDetected).toBe(true);
      expect(result.sentimentScore).toBe(-0.9);
      expect(result.category).toBe('urgent');
    });

    it('should override category to "urgent" when sentimentScore < -0.5', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'fan_engagement',
                confidence: 0.8,
                reasoning: 'Initially categorized as fan message',
                sentiment: 'negative',
                sentimentScore: -0.6,
                emotionalTone: ['disappointed'],
                sentimentReasoning: 'Negative sentiment detected',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage('I am very disappointed with your recent actions.', mockApiKey);

      // Should be overridden to urgent due to negative sentiment
      expect(result.category).toBe('urgent');
      expect(result.sentimentScore).toBe(-0.6);
    });

    it('should default to "general" category when confidence < 0.7', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'fan_engagement',
                confidence: 0.6,
                reasoning: 'Unclear message intent',
                sentiment: 'neutral',
                sentimentScore: 0.0,
                emotionalTone: ['neutral'],
                sentimentReasoning: 'No clear sentiment',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage('Hey', mockApiKey);

      expect(result.category).toBe('general');
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('should retry on transient errors', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'fan_engagement',
                  confidence: 0.9,
                  reasoning: 'Success on retry',
                  sentiment: 'positive',
                  sentimentScore: 0.8,
                  emotionalTone: ['happy'],
                  sentimentReasoning: 'Positive message',
                }),
              },
            },
          ],
        });

      const result = await categorizeMessage('Great job!', mockApiKey);

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.category).toBe('fan_engagement');
    });

    it('should throw error after exhausting retries', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent error'));

      await expect(categorizeMessage('Test message', mockApiKey)).rejects.toThrow(
        'Categorization and sentiment analysis failed after 4 attempts'
      );

      expect(mockCreate).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('scoreOpportunity', () => {
    it('should score high-value sponsorship opportunity correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 95,
                type: 'sponsorship',
                indicators: ['brand collaboration', 'budget discussion', 'long-term partnership'],
                analysis: 'High-value brand sponsorship with clear budget and partnership intent',
              }),
            },
          },
        ],
      });

      const result = await scoreOpportunity(
        'Hi, I represent Nike and we would like to sponsor your content for $5000',
        mockApiKey
      );

      expect(result.score).toBe(95);
      expect(result.type).toBe('sponsorship');
      expect(result.indicators).toContain('brand collaboration');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
          temperature: 0.5,
        })
      );
    });

    it('should score collaboration opportunity correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 65,
                type: 'collaboration',
                indicators: ['collaboration proposal', 'content partnership'],
                analysis: 'Content collaboration opportunity with another creator',
              }),
            },
          },
        ],
      });

      const result = await scoreOpportunity('Would you like to collaborate on a video together?', mockApiKey);

      expect(result.score).toBe(65);
      expect(result.type).toBe('collaboration');
    });

    it('should fallback to rule-based scoring on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await scoreOpportunity(
        'Hi, I represent Nike and we would like to sponsor your content for $5000',
        mockApiKey
      );

      // Should fallback to rule-based scoring
      expect(result.score).toBeGreaterThan(0);
      expect(['sponsorship', 'collaboration', 'partnership', 'sale']).toContain(result.type);
      expect(result.analysis).toContain('rule-based fallback');
    });

    it('should detect budget keywords in rule-based fallback', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await scoreOpportunity('Our budget is $2000 for this campaign', mockApiKey);

      expect(result.score).toBeGreaterThan(0);
      expect(result.indicators).toContain('budget discussion');
    });

    it('should detect sponsorship keywords in rule-based fallback', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await scoreOpportunity('We want to sponsor your channel', mockApiKey);

      expect(result.type).toBe('sponsorship');
      expect(result.indicators).toContain('sponsorship keywords');
    });
  });

  describe('Response Format Validation', () => {
    it('categorization result should match expected interface', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'fan_engagement',
                confidence: 0.9,
                reasoning: 'Test',
                sentiment: 'positive',
                sentimentScore: 0.8,
                emotionalTone: ['happy'],
                sentimentReasoning: 'Test',
              }),
            },
          },
        ],
      });

      const result = await categorizeMessage('Test message', mockApiKey);

      // Verify all expected fields are present
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('sentimentScore');
      expect(result).toHaveProperty('emotionalTone');
      expect(result).toHaveProperty('sentimentReasoning');
      expect(result).toHaveProperty('crisisDetected');

      // Verify types
      expect(typeof result.category).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.reasoning).toBe('string');
      expect(typeof result.sentiment).toBe('string');
      expect(typeof result.sentimentScore).toBe('number');
      expect(Array.isArray(result.emotionalTone)).toBe(true);
      expect(typeof result.sentimentReasoning).toBe('string');
      expect(typeof result.crisisDetected).toBe('boolean');
    });

    it('opportunity score result should match expected interface', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 85,
                type: 'sponsorship',
                indicators: ['test'],
                analysis: 'Test analysis',
              }),
            },
          },
        ],
      });

      const result = await scoreOpportunity('Test message', mockApiKey);

      // Verify all expected fields are present
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('indicators');
      expect(result).toHaveProperty('analysis');

      // Verify types
      expect(typeof result.score).toBe('number');
      expect(typeof result.type).toBe('string');
      expect(Array.isArray(result.indicators)).toBe(true);
      expect(typeof result.analysis).toBe('string');
    });
  });
});
