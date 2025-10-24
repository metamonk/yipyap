/**
 * Main AI service abstraction layer
 * @module functions/src/ai/aiService
 */

import { createProvider, type AIProvider } from './providers';
import { selectModel } from './modelSelector';
import type {
  AIProviderConfig,
  ModelSelectionCriteria,
  AIOperationResult,
  AIError,
} from '../types/ai';

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  threshold: 10, // Number of consecutive failures to open circuit
  cooldownMs: 60000, // 60 seconds cooldown period
} as const;

/**
 * Circuit breaker state for a provider
 */
interface CircuitBreakerState {
  failureCount: number;
  isOpen: boolean;
  openedAt: number | null;
}

/**
 * Main AI service for orchestrating AI operations
 *
 * @remarks
 * Provides unified interface for AI operations with:
 * - Automatic model selection based on criteria
 * - Retry with model degradation (Quality → Speed/Cost)
 * - Circuit breaker pattern to prevent cascading failures
 * - Comprehensive error handling and logging
 *
 * @example
 * ```typescript
 * const service = new AIService({
 *   openai: {
 *     name: 'openai',
 *     apiKey: 'sk-...',
 *     models: { fast: 'gpt-4o-mini', quality: 'gpt-4-turbo-preview', cost: 'gpt-4o-mini' }
 *   }
 * });
 *
 * const result = await service.processRequest(
 *   { priority: 'speed' },
 *   'Categorize this message'
 * );
 * ```
 */
export class AIService {
  private openaiProvider: AIProvider | null = null;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private aiEnabled: boolean;

  /**
   * Creates an AI service instance
   * @param providers - Configuration for available AI providers
   * @param aiEnabled - Feature flag to enable/disable AI functionality (default: true)
   */
  constructor(
    providers: {
      openai?: AIProviderConfig;
    },
    aiEnabled: boolean = true
  ) {
    this.aiEnabled = aiEnabled;

    // Initialize OpenAI provider if configured
    if (providers.openai) {
      this.openaiProvider = createProvider(providers.openai);
      this.initCircuitBreaker('openai');
    }
  }

  /**
   * Checks if AI features are enabled
   * @returns True if AI is enabled, false otherwise
   *
   * @remarks
   * Used to implement graceful degradation when AI features are disabled.
   * Components should check this before making AI requests.
   *
   * @example
   * ```typescript
   * if (!aiService.isEnabled()) {
   *   console.log('AI features are currently disabled');
   *   return null;
   * }
   * ```
   */
  isEnabled(): boolean {
    return this.aiEnabled;
  }

  /**
   * Processes an AI request with automatic provider selection and fallback
   *
   * @param criteria - Model selection criteria
   * @param prompt - Input prompt for the AI operation
   * @returns Promise resolving to operation result
   *
   * @remarks
   * Operation flow:
   * 1. Select model based on criteria (speed/quality/cost)
   * 2. Check if OpenAI provider's circuit is open
   * 3. Execute request with selected model
   * 4. If quality model fails, attempt degradation to cost-optimized model
   * 5. Update circuit breaker state based on result
   * 6. Log operation details
   *
   * @example
   * ```typescript
   * const result = await service.processRequest(
   *   { priority: 'quality', maxTokens: 1500 },
   *   'Generate a response to: How are you?'
   * );
   *
   * if (result.success) {
   *   console.log('Response:', result.data);
   * } else {
   *   console.error('Error:', result.error);
   * }
   * ```
   */
  async processRequest(
    criteria: ModelSelectionCriteria,
    prompt: string
  ): Promise<AIOperationResult<string>> {
    const startTime = Date.now();

    // Check if AI features are enabled
    if (!this.aiEnabled) {
      const error: AIError = {
        code: 'AI_DISABLED',
        message: 'AI features are currently disabled',
        type: 'validation',
        retryable: false,
      };

      console.warn('[AIService] AI features disabled', { criteria });

      return {
        success: false,
        error,
        provider: 'none',
        model: 'none',
        tokensUsed: 0,
        latency: Date.now() - startTime,
      };
    }

    // Select model based on criteria
    const modelConfig = selectModel(criteria);
    const primaryProviderName = modelConfig.provider;

    console.log('[AIService] Processing request', {
      criteria,
      selectedProvider: primaryProviderName,
      selectedModel: modelConfig.model,
    });

    // Try OpenAI provider with selected model
    if (this.openaiProvider && this.canUseProvider('openai')) {
      const result = await this.openaiProvider.generateText(modelConfig, prompt);

      // Update circuit breaker based on result
      if (result.success) {
        this.recordSuccess('openai');
      } else {
        this.recordFailure('openai');
      }

      // Log operation
      this.logOperation(result, criteria, startTime);

      // Return if successful
      if (result.success) {
        return result;
      }

      // Primary model failed, attempt degradation for quality requests
      if (criteria.priority === 'quality') {
        console.warn('[AIService] Quality model failed, attempting degradation to cost model', {
          primaryModel: modelConfig.model,
          error: result.error,
        });

        // Degrade to cost-optimized model
        const fallbackModel = selectModel({
          priority: 'cost',
          maxTokens: criteria.maxTokens,
          temperature: criteria.temperature,
        });

        const fallbackResult = await this.openaiProvider.generateText(fallbackModel, prompt);

        // Update circuit breaker
        if (fallbackResult.success) {
          this.recordSuccess('openai');
        } else {
          this.recordFailure('openai');
        }

        // Log operation
        this.logOperation(fallbackResult, criteria, startTime);

        return fallbackResult;
      }
    }

    // OpenAI provider failed or unavailable
    const latency = Date.now() - startTime;
    const error: AIError = {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'OpenAI provider is currently unavailable.',
      type: 'provider',
      retryable: true,
    };

    console.error('[AIService] OpenAI provider failed', { error, latency });

    return {
      success: false,
      error,
      provider: 'none',
      model: 'none',
      tokensUsed: 0,
      latency,
    };
  }


  /**
   * Checks if a provider can be used (circuit not open)
   * @param providerName - Provider name to check
   * @returns True if provider can be used, false if circuit is open
   */
  private canUseProvider(providerName: string): boolean {
    const breaker = this.circuitBreakers.get(providerName);
    if (!breaker) {
      return false;
    }

    // Check if circuit is open and cooldown has elapsed
    if (breaker.isOpen && breaker.openedAt) {
      const elapsed = Date.now() - breaker.openedAt;
      if (elapsed >= CIRCUIT_BREAKER_CONFIG.cooldownMs) {
        // Close circuit after cooldown
        breaker.isOpen = false;
        breaker.openedAt = null;
        breaker.failureCount = 0;
        console.log('[CircuitBreaker] Circuit closed after cooldown', { providerName });
      } else {
        console.warn('[CircuitBreaker] Circuit is open', {
          providerName,
          remainingCooldown: CIRCUIT_BREAKER_CONFIG.cooldownMs - elapsed,
        });
        return false;
      }
    }

    return !breaker.isOpen;
  }

  /**
   * Records a successful operation for circuit breaker
   * @param providerName - Provider name
   */
  private recordSuccess(providerName: string): void {
    const breaker = this.circuitBreakers.get(providerName);
    if (breaker) {
      breaker.failureCount = 0;
      if (breaker.isOpen) {
        breaker.isOpen = false;
        breaker.openedAt = null;
        console.log('[CircuitBreaker] Circuit closed due to success', { providerName });
      }
    }
  }

  /**
   * Records a failed operation for circuit breaker
   * @param providerName - Provider name
   */
  private recordFailure(providerName: string): void {
    const breaker = this.circuitBreakers.get(providerName);
    if (breaker) {
      breaker.failureCount++;

      if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.threshold && !breaker.isOpen) {
        breaker.isOpen = true;
        breaker.openedAt = Date.now();
        console.error('[CircuitBreaker] Circuit opened due to failures', {
          providerName,
          failureCount: breaker.failureCount,
          threshold: CIRCUIT_BREAKER_CONFIG.threshold,
        });
      }
    }
  }

  /**
   * Initializes circuit breaker state for a provider
   * @param providerName - Provider name
   */
  private initCircuitBreaker(providerName: string): void {
    this.circuitBreakers.set(providerName, {
      failureCount: 0,
      isOpen: false,
      openedAt: null,
    });
  }

  /**
   * Logs operation details
   * @param result - Operation result
   * @param criteria - Selection criteria used
   * @param startTime - Operation start timestamp
   */
  private logOperation(
    result: AIOperationResult<string>,
    criteria: ModelSelectionCriteria,
    startTime: number
  ): void {
    const totalLatency = Date.now() - startTime;

    if (result.success) {
      console.log('[AIService] Operation completed successfully', {
        criteria,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latency: totalLatency,
      });
    } else {
      console.error('[AIService] Operation failed', {
        criteria,
        provider: result.provider,
        model: result.model,
        error: result.error,
        latency: totalLatency,
      });
    }
  }
}
