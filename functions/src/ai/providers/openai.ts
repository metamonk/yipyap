/**
 * OpenAI provider implementation using Vercel AI SDK
 * @module functions/src/ai/providers/openai
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { AIError, AIOperationResult, ModelConfig } from '../../types/ai';

/**
 * Retry configuration for OpenAI API calls
 * @remarks
 * Uses 3 retries with exponential backoff to handle transient errors.
 * Fewer retries than standard operations (3 vs 5) due to AI provider timeout constraints.
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffDelays: [1000, 2000, 4000], // milliseconds
} as const;

/**
 * OpenAI provider for GPT model operations
 *
 * @remarks
 * Wraps the Vercel AI SDK OpenAI provider with error handling, retry logic, and logging.
 * Supports GPT-4 Turbo and other OpenAI models for quality-priority operations.
 *
 * @example
 * ```typescript
 * const provider = new OpenAIProvider('sk-...');
 * const result = await provider.generateText({
 *   provider: 'openai',
 *   model: 'gpt-4-turbo-preview',
 *   config: { maxTokens: 1000, temperature: 0.7 }
 * }, 'Categorize this message: Hello world');
 * ```
 */
export class OpenAIProvider {
  private client: ReturnType<typeof createOpenAI>;

  /**
   * Creates an OpenAI provider instance
   * @param apiKey - OpenAI API key for authentication
   * @param orgId - Optional OpenAI organization ID
   */
  constructor(apiKey: string, orgId?: string) {
    this.client = createOpenAI({
      apiKey,
      organization: orgId,
    });
  }

  /**
   * Generates text using an OpenAI model with retry logic
   *
   * @param modelConfig - Model configuration (model name and generation parameters)
   * @param prompt - Input prompt for text generation
   * @returns Promise resolving to operation result with generated text, tokens, and latency
   * @throws Never throws - all errors are captured in AIOperationResult.error
   *
   * @example
   * ```typescript
   * const result = await provider.generateText(
   *   {
   *     provider: 'openai',
   *     model: 'gpt-4-turbo-preview',
   *     config: { maxTokens: 1000, temperature: 0.7 }
   *   },
   *   'What is the sentiment of this message: I love this!'
   * );
   * if (result.success) {
   *   console.log('Generated text:', result.data);
   *   console.log('Tokens used:', result.tokensUsed);
   *   console.log('Latency:', result.latency, 'ms');
   * } else {
   *   console.error('Error:', result.error);
   * }
   * ```
   */
  async generateText(
    modelConfig: ModelConfig,
    prompt: string
  ): Promise<AIOperationResult<string>> {
    const startTime = Date.now();
    let lastError: AIError | undefined;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const model = this.client(modelConfig.model);

        const result = await generateText({
          model,
          prompt,
          maxOutputTokens: modelConfig.config.maxTokens,
          temperature: modelConfig.config.temperature,
        });

        const latency = Date.now() - startTime;

        // Log successful operation
        console.log('[OpenAI] Operation succeeded', {
          model: modelConfig.model,
          tokensUsed: result.usage?.totalTokens || 0,
          latency,
          attempt: attempt + 1,
        });

        return {
          success: true,
          data: result.text,
          provider: 'openai',
          model: modelConfig.model,
          tokensUsed: result.usage?.totalTokens || 0,
          latency,
        };
      } catch (error) {
        lastError = this.categorizeError(error);

        // Log retry attempt
        console.warn('[OpenAI] Attempt failed', {
          model: modelConfig.model,
          attempt: attempt + 1,
          maxRetries: RETRY_CONFIG.maxRetries,
          error: lastError,
        });

        // Don't retry if error is not retryable or we've exhausted retries
        if (!lastError.retryable || attempt >= RETRY_CONFIG.maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        await this.sleep(RETRY_CONFIG.backoffDelays[attempt]);
      }
    }

    // All retries exhausted
    const latency = Date.now() - startTime;

    console.error('[OpenAI] Operation failed after retries', {
      model: modelConfig.model,
      latency,
      error: lastError,
    });

    return {
      success: false,
      error: lastError,
      provider: 'openai',
      model: modelConfig.model,
      tokensUsed: 0,
      latency,
    };
  }

  /**
   * Categorizes an error for appropriate handling
   *
   * @param error - Raw error from OpenAI API
   * @returns Categorized AIError with retryable flag
   *
   * @remarks
   * Error categorization determines retry behavior:
   * - network: Retryable (connection issues)
   * - auth: Not retryable (invalid API key)
   * - rate_limit: Retryable (rate limit exceeded)
   * - validation: Not retryable (invalid input)
   * - provider: Retryable (OpenAI service error)
   * - unknown: Retryable (cautious retry for unexpected errors)
   */
  private categorizeError(error: unknown): AIError {
    // Handle Error objects
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors
      if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      ) {
        return {
          code: 'NETWORK_ERROR',
          message: 'Network connection failed. Please check your internet connection.',
          type: 'network',
          retryable: true,
        };
      }

      // Authentication errors
      if (
        message.includes('unauthorized') ||
        message.includes('invalid api key') ||
        message.includes('authentication')
      ) {
        return {
          code: 'AUTH_ERROR',
          message: 'Invalid OpenAI API key. Please check your configuration.',
          type: 'auth',
          retryable: false,
        };
      }

      // Rate limiting errors
      if (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('quota')
      ) {
        return {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          type: 'rate_limit',
          retryable: true,
        };
      }

      // Validation errors
      if (
        message.includes('invalid') ||
        message.includes('validation') ||
        message.includes('bad request')
      ) {
        return {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters.',
          type: 'validation',
          retryable: false,
        };
      }

      // Provider-specific errors
      if (
        message.includes('openai') ||
        message.includes('server error') ||
        message.includes('service unavailable')
      ) {
        return {
          code: 'PROVIDER_ERROR',
          message: 'OpenAI service is temporarily unavailable.',
          type: 'provider',
          retryable: true,
        };
      }
    }

    // Unknown errors - retry cautiously
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
      type: 'unknown',
      retryable: true,
    };
  }

  /**
   * Sleeps for the specified duration
   * @param ms - Duration in milliseconds
   * @returns Promise that resolves after the specified delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
