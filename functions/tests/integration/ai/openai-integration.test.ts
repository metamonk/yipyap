/**
 * Integration tests for OpenAI provider
 * @module functions/tests/integration/ai/openai-integration.test
 *
 * IMPORTANT: These tests make real API calls to OpenAI and incur costs (~$0.01 per run)
 * Set SKIP_INTEGRATION_TESTS=1 to skip these tests
 * Requires OPENAI_TEST_API_KEY environment variable
 */

import { OpenAIProvider } from '../../../src/ai/providers/openai';
import type { ModelConfig } from '../../../src/types/ai';

const SKIP_TESTS = process.env.SKIP_INTEGRATION_TESTS === '1';
const TEST_API_KEY = process.env.OPENAI_TEST_API_KEY;

describe.skip('OpenAI Integration Tests', () => {
  let provider: OpenAIProvider;

  beforeAll(() => {
    if (!TEST_API_KEY) {
      console.warn('OPENAI_TEST_API_KEY not set, skipping integration tests');
    }

    if (TEST_API_KEY && !SKIP_TESTS) {
      provider = new OpenAIProvider(TEST_API_KEY);
    }
  });

  describe('GPT-4o-mini (speed/cost model)', () => {
    const modelConfig: ModelConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      config: {
        maxTokens: 100,
        temperature: 0.7,
      },
    };

    it('should generate text successfully', async () => {
      if (SKIP_TESTS || !TEST_API_KEY) {
        return;
      }

      const result = await provider.generateText(
        modelConfig,
        'Say "Hello, World!" and nothing else.'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.latency).toBeGreaterThan(0);
    }, 10000);

    it('should handle categorization tasks', async () => {
      if (SKIP_TESTS || !TEST_API_KEY) {
        return;
      }

      const result = await provider.generateText(
        modelConfig,
        'Categorize this message as "business" or "personal": "Can we schedule a meeting to discuss the project?"'
      );

      expect(result.success).toBe(true);
      expect(result.data?.toLowerCase()).toContain('business');
    }, 10000);

    it('should respect token limits', async () => {
      if (SKIP_TESTS || !TEST_API_KEY) {
        return;
      }

      const shortModelConfig: ModelConfig = {
        ...modelConfig,
        config: {
          ...modelConfig.config,
          maxTokens: 10,
        },
      };

      const result = await provider.generateText(
        shortModelConfig,
        'Write a long essay about artificial intelligence.'
      );

      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBeLessThanOrEqual(20); // Allow some overhead
    }, 10000);
  });

  describe('GPT-4 Turbo (quality model)', () => {
    const modelConfig: ModelConfig = {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      config: {
        maxTokens: 150,
        temperature: 0.8,
      },
    };

    it('should generate high-quality responses', async () => {
      if (SKIP_TESTS || !TEST_API_KEY) {
        return;
      }

      const result = await provider.generateText(
        modelConfig,
        'Explain quantum computing in one sentence.'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4-turbo-preview');
      expect(result.latency).toBeGreaterThan(0);
    }, 15000);
  });

  describe('error handling', () => {
    it('should handle invalid API key', async () => {
      if (SKIP_TESTS) {
        return;
      }

      const invalidProvider = new OpenAIProvider('invalid-key');
      const modelConfig: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        config: {
          maxTokens: 50,
          temperature: 0.7,
        },
      };

      const result = await invalidProvider.generateText(
        modelConfig,
        'Test prompt'
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('auth');
      expect(result.error?.retryable).toBe(false);
    }, 10000);

    it('should handle network errors gracefully', async () => {
      if (SKIP_TESTS || !TEST_API_KEY) {
        return;
      }

      const modelConfig: ModelConfig = {
        provider: 'openai',
        model: 'invalid-model-name',
        config: {
          maxTokens: 50,
          temperature: 0.7,
        },
      };

      const result = await provider.generateText(
        modelConfig,
        'Test prompt'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000);
  });

  describe('performance', () => {
    it('should complete requests within reasonable time', async () => {
      if (SKIP_TESTS || !TEST_API_KEY) {
        return;
      }

      const modelConfig: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        config: {
          maxTokens: 50,
          temperature: 0.7,
        },
      };

      const startTime = Date.now();
      const result = await provider.generateText(
        modelConfig,
        'Say hello.'
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    }, 10000);
  });
});

describe('OpenAI Integration Tests (Instructions)', () => {
  it('should provide instructions when skipped', () => {
    if (SKIP_TESTS) {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OpenAI Integration Tests Skipped
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To run these tests:

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Set the environment variable:
   export OPENAI_TEST_API_KEY=sk-...
3. Run tests without skip flag:
   npm test -- --testPathPattern="openai-integration"

⚠️  WARNING: These tests make real API calls and incur costs (~$0.01)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    }

    if (!TEST_API_KEY && !SKIP_TESTS) {
      console.warn('OPENAI_TEST_API_KEY not set. Set it to run integration tests.');
    }

    expect(true).toBe(true);
  });
});
