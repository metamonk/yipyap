/**
 * Unit tests for OpenAI provider
 * @module functions/tests/unit/ai/providers/openai.test
 */

import { OpenAIProvider } from '../../../../src/ai/providers/openai';
import type { ModelConfig } from '../../../../src/types/ai';

// Mock the Vercel AI SDK
jest.mock('@ai-sdk/openai');
jest.mock('ai');

import { generateText } from 'ai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  const mockModelConfig: ModelConfig = {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    config: {
      maxTokens: 1000,
      temperature: 0.7,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider('test-api-key', 'test-org-id');
  });

  describe('successful text generation', () => {
    it('should generate text successfully', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockResolvedValue({
        text: 'Generated response',
        usage: { totalTokens: 150 },
      } as any);

      const result = await provider.generateText(mockModelConfig, 'Test prompt');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Generated response');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4-turbo-preview');
      expect(result.tokensUsed).toBe(150);
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should include usage and latency metadata', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockResolvedValue({
        text: 'Test',
        usage: { totalTokens: 50 },
      } as any);

      const startTime = Date.now();
      const result = await provider.generateText(mockModelConfig, 'Quick test');
      const endTime = Date.now();

      expect(result.tokensUsed).toBe(50);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.latency).toBeLessThan(endTime - startTime + 100);
    });
  });

  describe('error handling', () => {
    it('should categorize network errors correctly', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('network timeout'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('network');
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.retryable).toBe(true);
    });

    it('should categorize authentication errors correctly', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('unauthorized invalid api key'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('auth');
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.retryable).toBe(false);
    });

    it('should categorize rate limit errors correctly', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('rate limit exceeded'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('rate_limit');
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.error?.retryable).toBe(true);
    });

    it('should categorize validation errors correctly', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('invalid request bad request'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.retryable).toBe(false);
    });

    it('should categorize provider errors correctly', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('openai server error'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.retryable).toBe(true);
    });

    it('should categorize unknown errors as retryable', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('something unexpected'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('unknown');
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({
          text: 'Success after retries',
          usage: { totalTokens: 100 },
        } as any);

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Success after retries');
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('unauthorized'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and fail', async () => {
      const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
      mockGenerateText.mockRejectedValue(new Error('network timeout'));

      const result = await provider.generateText(mockModelConfig, 'Test');

      expect(result.success).toBe(false);
      expect(mockGenerateText).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });
});
