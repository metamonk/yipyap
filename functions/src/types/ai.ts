/**
 * AI-specific TypeScript type definitions for Phase 2 AI features
 * @module types/ai
 */

/**
 * Configuration for an AI provider (OpenAI or Anthropic)
 *
 * @remarks
 * Defines the settings needed to initialize and use an AI provider.
 * Each provider requires API keys and model selections for different priorities.
 *
 * @example
 * ```typescript
 * const openaiConfig: AIProviderConfig = {
 *   name: 'openai',
 *   apiKey: 'sk-...',
 *   baseURL: 'https://api.openai.com/v1',
 *   models: {
 *     fast: 'gpt-3.5-turbo',
 *     quality: 'gpt-4-turbo-preview',
 *     cost: 'gpt-3.5-turbo'
 *   }
 * };
 * ```
 */
export interface AIProviderConfig {
  /** Provider name identifier */
  name: 'openai' | 'anthropic';

  /** API key for authentication */
  apiKey: string;

  /** Optional custom base URL for API endpoint */
  baseURL?: string;

  /** Model identifiers for different priorities */
  models: {
    /** Fast, low-latency model (e.g., 'claude-3-haiku') */
    fast: string;

    /** High-quality model (e.g., 'gpt-4-turbo-preview') */
    quality: string;

    /** Cost-optimized model */
    cost: string;
  };
}

/**
 * Criteria for selecting which AI model to use for an operation
 *
 * @remarks
 * Determines model selection based on operation requirements.
 * Priority dictates whether to optimize for speed, quality, or cost.
 *
 * @example
 * ```typescript
 * const criteria: ModelSelectionCriteria = {
 *   priority: 'speed',
 *   maxTokens: 1000,
 *   temperature: 0.7
 * };
 * ```
 */
export interface ModelSelectionCriteria {
  /** Operation priority: speed (fast response), quality (best output), or cost (budget-conscious) */
  priority: 'speed' | 'quality' | 'cost';

  /** Maximum tokens to generate (optional) */
  maxTokens?: number;

  /** Sampling temperature for generation (0.0-1.0, optional) */
  temperature?: number;
}

/**
 * Configuration for a selected AI model
 *
 * @remarks
 * Returned by model selection logic to specify which provider and model to use.
 * Includes generation parameters for the selected model.
 *
 * @example
 * ```typescript
 * const modelConfig: ModelConfig = {
 *   provider: 'anthropic',
 *   model: 'claude-3-haiku-20240307',
 *   config: {
 *     maxTokens: 1000,
 *     temperature: 0.7
 *   }
 * };
 * ```
 */
export interface ModelConfig {
  /** Provider to use ('openai' or 'anthropic') */
  provider: 'openai' | 'anthropic';

  /** Specific model identifier */
  model: string;

  /** Generation configuration parameters */
  config: {
    /** Maximum tokens to generate */
    maxTokens: number;

    /** Sampling temperature (0.0-1.0) */
    temperature: number;
  };
}

/**
 * Result of an AI operation with success/failure information
 *
 * @typeParam T - Type of the data returned on success
 *
 * @remarks
 * Generic interface for all AI operation results.
 * Includes metadata about the operation (provider, model, tokens, latency).
 *
 * @example
 * ```typescript
 * const result: AIOperationResult<string> = {
 *   success: true,
 *   data: 'Generated text response',
 *   provider: 'openai',
 *   model: 'gpt-4-turbo-preview',
 *   tokensUsed: 150,
 *   latency: 1234
 * };
 * ```
 */
export interface AIOperationResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Data returned by the operation (present if success is true) */
  data?: T;

  /** Error details (present if success is false) */
  error?: AIError;

  /** Provider used for the operation */
  provider: string;

  /** Model used for the operation */
  model: string;

  /** Total tokens consumed by the operation */
  tokensUsed: number;

  /** Operation latency in milliseconds */
  latency: number;
}

/**
 * Detailed error information from an AI operation
 *
 * @remarks
 * Categorizes errors for appropriate handling and retry logic.
 * Network and rate_limit errors are retryable, auth and validation are not.
 *
 * @example
 * ```typescript
 * const error: AIError = {
 *   code: 'RATE_LIMIT_EXCEEDED',
 *   message: 'Rate limit exceeded, please retry after 60 seconds',
 *   type: 'rate_limit',
 *   retryable: true
 * };
 * ```
 */
export interface AIError {
  /** Machine-readable error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Error type for categorization */
  type: 'network' | 'auth' | 'rate_limit' | 'validation' | 'provider' | 'unknown';

  /** Whether this error is retryable */
  retryable: boolean;
}
