/**
 * Unit tests for AIService (OpenAI-only architecture)
 * @module functions/tests/unit/ai/aiService.test
 */

import { AIService } from '../../../src/ai/aiService';
import { OpenAIProvider } from '../../../src/ai/providers/openai';
import type { AIProviderConfig } from '../../../src/types/ai';

// Mock the providers module
jest.mock('../../../src/ai/providers/openai');

describe('AIService (OpenAI-only)', () => {
  let mockOpenAIProvider: jest.Mocked<OpenAIProvider>;
  let mockOpenAIConfig: AIProviderConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOpenAIConfig = {
      name: 'openai',
      apiKey: 'test-openai-key',
      models: {
        fast: 'gpt-4o-mini',
        quality: 'gpt-4-turbo-preview',
        cost: 'gpt-4o-mini',
      },
    };

    mockOpenAIProvider = {
      generateText: jest.fn(),
    } as any;

    (OpenAIProvider as jest.MockedClass<typeof OpenAIProvider>).mockImplementation(
      () => mockOpenAIProvider
    );
  });

  describe('initialization', () => {
    it('should initialize with OpenAI provider', () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      expect(OpenAIProvider).toHaveBeenCalledWith('test-openai-key', undefined);
      expect(service.isEnabled()).toBe(true);
    });

    it('should respect aiEnabled flag', () => {
      const service = new AIService(
        {
          openai: mockOpenAIConfig,
        },
        false
      );

      expect(service.isEnabled()).toBe(false);
    });

    it('should handle missing provider configuration', () => {
      const service = new AIService({});

      expect(OpenAIProvider).not.toHaveBeenCalled();
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('successful operations', () => {
    it('should process request successfully with OpenAI', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: true,
        data: 'Generated text',
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        tokensUsed: 150,
        latency: 500,
      });

      const result = await service.processRequest(
        { priority: 'quality' },
        'Test prompt'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('Generated text');
      expect(result.provider).toBe('openai');
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledTimes(1);
    });

    it('should use speed model for speed priority', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: true,
        data: 'Fast response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
        latency: 200,
      });

      const result = await service.processRequest({ priority: 'speed' }, 'Test');

      expect(result.success).toBe(true);
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o-mini',
        }),
        'Test'
      );
    });

    it('should use cost model for cost priority', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: true,
        data: 'Cost-optimized response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 50,
        latency: 300,
      });

      const result = await service.processRequest({ priority: 'cost' }, 'Test');

      expect(result.success).toBe(true);
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o-mini',
          config: expect.objectContaining({
            maxTokens: 500,
          }),
        }),
        'Test'
      );
    });
  });

  describe('model degradation fallback', () => {
    it('should degrade to cost model when quality model fails', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      // First call (quality model) fails
      mockOpenAIProvider.generateText
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: 'Provider unavailable',
            type: 'provider',
            retryable: true,
          },
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          tokensUsed: 0,
          latency: 100,
        })
        // Second call (cost model) succeeds
        .mockResolvedValueOnce({
          success: true,
          data: 'Fallback response',
          provider: 'openai',
          model: 'gpt-4o-mini',
          tokensUsed: 75,
          latency: 200,
        });

      const result = await service.processRequest({ priority: 'quality' }, 'Test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Fallback response');
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledTimes(2);

      // Verify first call was quality model
      expect(mockOpenAIProvider.generateText).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
        }),
        'Test'
      );

      // Verify second call was cost model
      expect(mockOpenAIProvider.generateText).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          model: 'gpt-4o-mini',
        }),
        'Test'
      );
    });

    it('should not degrade for speed priority failures', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Provider unavailable',
          type: 'provider',
          retryable: true,
        },
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 0,
        latency: 100,
      });

      const result = await service.processRequest({ priority: 'speed' }, 'Test');

      expect(result.success).toBe(false);
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledTimes(1);
    });

    it('should not degrade for cost priority failures', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Provider unavailable',
          type: 'provider',
          retryable: true,
        },
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 0,
        latency: 100,
      });

      const result = await service.processRequest({ priority: 'cost' }, 'Test');

      expect(result.success).toBe(false);
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI disabled state', () => {
    it('should return error when AI is disabled', async () => {
      const service = new AIService(
        {
          openai: mockOpenAIConfig,
        },
        false
      );

      const result = await service.processRequest({ priority: 'quality' }, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_DISABLED');
      expect(result.error?.message).toBe('AI features are currently disabled');
      expect(mockOpenAIProvider.generateText).not.toHaveBeenCalled();
    });
  });

  describe('provider unavailable', () => {
    it('should return error when no provider is configured', async () => {
      const service = new AIService({});

      const result = await service.processRequest({ priority: 'quality' }, 'Test');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROVIDER_UNAVAILABLE');
      expect(result.error?.message).toBe('OpenAI provider is currently unavailable.');
    });
  });

  describe('circuit breaker', () => {
    it('should track successful operations', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: true,
        data: 'Success',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
        latency: 200,
      });

      await service.processRequest({ priority: 'speed' }, 'Test 1');
      await service.processRequest({ priority: 'speed' }, 'Test 2');
      await service.processRequest({ priority: 'speed' }, 'Test 3');

      expect(mockOpenAIProvider.generateText).toHaveBeenCalledTimes(3);
    });

    it('should track failed operations', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Provider error',
          type: 'provider',
          retryable: true,
        },
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 0,
        latency: 100,
      });

      const result1 = await service.processRequest({ priority: 'speed' }, 'Test 1');
      const result2 = await service.processRequest({ priority: 'speed' }, 'Test 2');

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(mockOpenAIProvider.generateText).toHaveBeenCalledTimes(2);
    });
  });

  describe('custom parameters', () => {
    it('should pass custom maxTokens to provider', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: true,
        data: 'Response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 150,
        latency: 300,
      });

      await service.processRequest(
        { priority: 'speed', maxTokens: 1500 },
        'Test'
      );

      expect(mockOpenAIProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            maxTokens: 1500,
          }),
        }),
        'Test'
      );
    });

    it('should pass custom temperature to provider', async () => {
      const service = new AIService({
        openai: mockOpenAIConfig,
      });

      mockOpenAIProvider.generateText.mockResolvedValue({
        success: true,
        data: 'Response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
        latency: 250,
      });

      await service.processRequest(
        { priority: 'speed', temperature: 0.9 },
        'Test'
      );

      expect(mockOpenAIProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            temperature: 0.9,
          }),
        }),
        'Test'
      );
    });
  });
});
