/**
 * Unit tests for sentiment analysis in aiClient
 * Tests the parsing logic for combined categorization and sentiment analysis
 */

import { categorizeMessage, type SentimentType } from '../../../api/utils/aiClient';

// Mock the Vercel AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'gpt-4o-mini'),
}));

import { generateText } from 'ai';

describe('aiClient - Sentiment Analysis', () => {
  const mockApiKey = 'test-api-key';
  const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCategorizationResponse with sentiment', () => {
    it('should parse valid response with positive sentiment', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.95,
        reasoning: 'Positive fan message',
        sentiment: 'positive',
        sentimentScore: 0.85,
        emotionalTone: ['excited', 'grateful'],
        sentimentReasoning: 'Enthusiastic and appreciative tone',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage('Love your content!', mockApiKey);

      expect(result.category).toBe('fan_engagement');
      expect(result.sentiment).toBe('positive');
      expect(result.sentimentScore).toBe(0.85);
      expect(result.emotionalTone).toEqual(['excited', 'grateful']);
      expect(result.crisisDetected).toBe(false);
    });

    it('should parse valid response with negative sentiment', async () => {
      const mockResponse = {
        category: 'urgent',
        confidence: 0.92,
        reasoning: 'Negative complaint',
        sentiment: 'negative',
        sentimentScore: -0.65,
        emotionalTone: ['frustrated', 'disappointed'],
        sentimentReasoning: 'Strong dissatisfaction expressed',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage(
        'This is terrible and disappointing',
        mockApiKey
      );

      expect(result.category).toBe('urgent');
      expect(result.sentiment).toBe('negative');
      expect(result.sentimentScore).toBe(-0.65);
      expect(result.crisisDetected).toBe(false);
    });

    it('should detect crisis when sentimentScore < -0.7', async () => {
      const mockResponse = {
        category: 'urgent',
        confidence: 0.98,
        reasoning: 'Crisis situation detected',
        sentiment: 'negative',
        sentimentScore: -0.85,
        emotionalTone: ['angry', 'desperate'],
        sentimentReasoning: 'Severe negative sentiment with crisis indicators',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage(
        'I am so angry and devastated, this is unbearable',
        mockApiKey
      );

      expect(result.category).toBe('urgent');
      expect(result.sentiment).toBe('negative');
      expect(result.sentimentScore).toBe(-0.85);
      expect(result.crisisDetected).toBe(true);
    });

    it('should override category to "urgent" when sentimentScore < -0.5', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.80,
        reasoning: 'Fan message but negative',
        sentiment: 'negative',
        sentimentScore: -0.6,
        emotionalTone: ['disappointed'],
        sentimentReasoning: 'Negative sentiment detected',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage(
        'I used to love your content but now disappointed',
        mockApiKey
      );

      // Category should be overridden to "urgent"
      expect(result.category).toBe('urgent');
      expect(result.sentiment).toBe('negative');
      expect(result.sentimentScore).toBe(-0.6);
      expect(result.crisisDetected).toBe(false);
    });

    it('should parse neutral sentiment correctly', async () => {
      const mockResponse = {
        category: 'general',
        confidence: 0.75,
        reasoning: 'General inquiry',
        sentiment: 'neutral',
        sentimentScore: 0.1,
        emotionalTone: ['curious'],
        sentimentReasoning: 'No strong emotional content',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage('What time is the event?', mockApiKey);

      expect(result.category).toBe('general');
      expect(result.sentiment).toBe('neutral');
      expect(result.sentimentScore).toBe(0.1);
      expect(result.emotionalTone).toEqual(['curious']);
      expect(result.crisisDetected).toBe(false);
    });

    it('should parse mixed sentiment correctly', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.88,
        reasoning: 'Mixed emotions in feedback',
        sentiment: 'mixed',
        sentimentScore: 0.2,
        emotionalTone: ['hopeful', 'frustrated'],
        sentimentReasoning: 'Both positive and negative elements',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage(
        'I love your work but the recent update has issues',
        mockApiKey
      );

      expect(result.category).toBe('fan_engagement');
      expect(result.sentiment).toBe('mixed');
      expect(result.sentimentScore).toBe(0.2);
      expect(result.emotionalTone).toContain('hopeful');
      expect(result.emotionalTone).toContain('frustrated');
    });

    it('should handle low confidence and preserve sentiment', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.65,
        reasoning: 'Unclear categorization',
        sentiment: 'positive',
        sentimentScore: 0.7,
        emotionalTone: ['excited'],
        sentimentReasoning: 'Positive tone detected',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage('Ambiguous message', mockApiKey);

      // Category should default to general, but sentiment preserved
      expect(result.category).toBe('general');
      expect(result.sentiment).toBe('positive');
      expect(result.sentimentScore).toBe(0.7);
    });
  });

  describe('Sentiment validation', () => {
    it('should reject invalid sentiment type', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.95,
        reasoning: 'Test',
        sentiment: 'invalid_sentiment',
        sentimentScore: 0.5,
        emotionalTone: ['test'],
        sentimentReasoning: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      await expect(
        categorizeMessage('Test message', mockApiKey)
      ).rejects.toThrow('Invalid sentiment');
    });

    it('should reject sentiment score out of range (> 1)', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.95,
        reasoning: 'Test',
        sentiment: 'positive',
        sentimentScore: 1.5,
        emotionalTone: ['test'],
        sentimentReasoning: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      await expect(
        categorizeMessage('Test message', mockApiKey)
      ).rejects.toThrow('Sentiment score must be between -1 and 1');
    });

    it('should reject sentiment score out of range (< -1)', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.95,
        reasoning: 'Test',
        sentiment: 'negative',
        sentimentScore: -1.5,
        emotionalTone: ['test'],
        sentimentReasoning: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      await expect(
        categorizeMessage('Test message', mockApiKey)
      ).rejects.toThrow('Sentiment score must be between -1 and 1');
    });

    it('should reject missing sentiment fields', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.95,
        reasoning: 'Test',
        // Missing sentiment and sentimentScore
        emotionalTone: ['test'],
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      await expect(
        categorizeMessage('Test message', mockApiKey)
      ).rejects.toThrow('missing required sentiment fields');
    });

    it('should reject non-array emotionalTone', async () => {
      const mockResponse = {
        category: 'fan_engagement',
        confidence: 0.95,
        reasoning: 'Test',
        sentiment: 'positive',
        sentimentScore: 0.8,
        emotionalTone: 'excited',
        sentimentReasoning: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      await expect(
        categorizeMessage('Test message', mockApiKey)
      ).rejects.toThrow('emotionalTone must be an array');
    });
  });

  describe('Crisis detection edge cases', () => {
    it('should not detect crisis for sentimentScore = -0.7 (boundary)', async () => {
      const mockResponse = {
        category: 'urgent',
        confidence: 0.90,
        reasoning: 'Negative but not crisis',
        sentiment: 'negative',
        sentimentScore: -0.7,
        emotionalTone: ['frustrated'],
        sentimentReasoning: 'Moderately negative',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage('Frustrated message', mockApiKey);

      expect(result.crisisDetected).toBe(false);
    });

    it('should detect crisis for sentimentScore = -0.71 (just over threshold)', async () => {
      const mockResponse = {
        category: 'urgent',
        confidence: 0.90,
        reasoning: 'Crisis detected',
        sentiment: 'negative',
        sentimentScore: -0.71,
        emotionalTone: ['angry'],
        sentimentReasoning: 'Crisis level negativity',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      } as any);

      const result = await categorizeMessage('Crisis message', mockApiKey);

      expect(result.crisisDetected).toBe(true);
    });
  });
});
