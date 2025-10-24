/**
 * AI operations monitoring and analytics
 * @module functions/src/ai/monitoring
 */

import { Langfuse } from 'langfuse';
import type { AIOperationResult } from '../types/ai';

/**
 * Langfuse client instance (initialized lazily)
 */
let langfuseClient: Langfuse | null = null;

/**
 * Model cost per 1M tokens (in USD)
 * @remarks
 * Based on current pricing as of 2025-10-23:
 * - OpenAI GPT-4 Turbo: $10 input, $30 output
 * - Anthropic Claude 3 Haiku: $0.25 input, $1.25 output
 */
const MODEL_COSTS = {
  // OpenAI models
  'gpt-4-turbo-preview': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // Anthropic models
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
} as const;

/**
 * Initializes Langfuse client if configured
 *
 * @param publicKey - Langfuse public key
 * @param secretKey - Langfuse secret key
 * @param baseUrl - Langfuse API base URL
 * @returns True if successfully initialized, false otherwise
 *
 * @remarks
 * Should be called once during service initialization.
 * If keys are not provided, monitoring will gracefully degrade (log warnings but continue).
 *
 * @example
 * ```typescript
 * const initialized = initLangfuse(
 *   process.env.LANGFUSE_PUBLIC_KEY,
 *   process.env.LANGFUSE_SECRET_KEY,
 *   process.env.LANGFUSE_BASE_URL
 * );
 * ```
 */
export function initLangfuse(
  publicKey?: string,
  secretKey?: string,
  baseUrl?: string
): boolean {
  if (!publicKey || !secretKey) {
    console.warn('[Monitoring] Langfuse not configured, monitoring disabled');
    return false;
  }

  try {
    langfuseClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: baseUrl || 'https://cloud.langfuse.com',
    });

    console.log('[Monitoring] Langfuse initialized successfully');
    return true;
  } catch (error) {
    console.error('[Monitoring] Failed to initialize Langfuse', { error });
    return false;
  }
}

/**
 * Logs an AI operation to Langfuse and Firebase Analytics
 *
 * @param operationType - Type of AI operation (e.g., 'categorize', 'generate_response')
 * @param result - Operation result containing metadata
 * @param userId - Optional user ID for tracking
 *
 * @remarks
 * Tracks comprehensive metrics for monitoring and cost analysis:
 * - Operation success/failure
 * - Provider and model used
 * - Token consumption
 * - Latency
 * - Error details (if failed)
 *
 * @example
 * ```typescript
 * const result = await provider.generateText(modelConfig, prompt);
 * logAIOperation('message_categorization', result, 'user123');
 * ```
 */
export function logAIOperation(
  operationType: string,
  result: AIOperationResult<unknown>,
  userId?: string
): void {
  try {
    // Log to Langfuse if configured
    if (langfuseClient) {
      const trace = langfuseClient.trace({
        name: operationType,
        userId,
        metadata: {
          provider: result.provider,
          model: result.model,
          tokensUsed: result.tokensUsed,
          latency: result.latency,
          success: result.success,
          errorType: result.error?.type,
          errorCode: result.error?.code,
        },
      });

      // Create a generation span
      trace.generation({
        name: `${result.provider}/${result.model}`,
        model: result.model,
        usage: {
          totalTokens: result.tokensUsed,
        },
        metadata: {
          latency: result.latency,
          success: result.success,
        },
      });

      // Flush to ensure data is sent
      langfuseClient.flush();
    }

    // Log to console for Firebase Cloud Logging
    console.log('[Monitoring] AI operation logged', {
      operationType,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
      latency: result.latency,
      success: result.success,
      error: result.error,
      userId,
    });

    // Calculate and log cost
    if (result.success && result.tokensUsed > 0) {
      const cost = estimateCost(result.model, result.tokensUsed);
      console.log('[Monitoring] Operation cost', {
        operationType,
        model: result.model,
        tokensUsed: result.tokensUsed,
        estimatedCost: cost,
      });
    }
  } catch (error) {
    console.error('[Monitoring] Failed to log AI operation', { error });
  }
}

/**
 * Tracks cost for AI operations
 *
 * @param model - Model identifier
 * @param tokensUsed - Total tokens consumed
 * @param userId - Optional user ID for cost attribution
 * @returns Estimated cost in USD
 *
 * @remarks
 * Estimates cost based on token usage and model pricing.
 * Assumes 50/50 split between input and output tokens for estimation.
 * Actual costs may vary based on exact input/output token ratio.
 *
 * @example
 * ```typescript
 * const cost = trackCost('gpt-4-turbo-preview', 1000, 'user123');
 * console.log(`Operation cost: $${cost.toFixed(4)}`);
 * ```
 */
export function trackCost(model: string, tokensUsed: number, userId?: string): number {
  const cost = estimateCost(model, tokensUsed);

  // Log cost tracking event
  console.log('[Monitoring] Cost tracked', {
    model,
    tokensUsed,
    estimatedCost: cost,
    userId,
  });

  // Send to Langfuse if configured
  if (langfuseClient) {
    try {
      langfuseClient.trace({
        name: 'cost_tracking',
        userId,
        metadata: {
          model,
          tokensUsed,
          estimatedCost: cost,
        },
      });

      langfuseClient.flush();
    } catch (error) {
      console.error('[Monitoring] Failed to track cost in Langfuse', { error });
    }
  }

  return cost;
}

/**
 * Estimates cost for a model operation
 *
 * @param model - Model identifier
 * @param tokensUsed - Total tokens consumed
 * @returns Estimated cost in USD
 *
 * @remarks
 * Uses a 50/50 split assumption for input/output tokens.
 * If model pricing is unknown, returns 0 with a warning.
 */
function estimateCost(model: string, tokensUsed: number): number {
  const pricing = MODEL_COSTS[model as keyof typeof MODEL_COSTS];

  if (!pricing) {
    console.warn('[Monitoring] Unknown model pricing', { model });
    return 0;
  }

  // Assume 50/50 split between input and output tokens
  const inputTokens = tokensUsed / 2;
  const outputTokens = tokensUsed / 2;

  // Calculate cost per million tokens
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Shuts down Langfuse client gracefully
 *
 * @remarks
 * Should be called during service shutdown to flush pending events.
 * Ensures all monitoring data is sent before termination.
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', () => {
 *   shutdownMonitoring();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownMonitoring(): Promise<void> {
  if (langfuseClient) {
    try {
      await langfuseClient.flush();
      console.log('[Monitoring] Langfuse shut down successfully');
    } catch (error) {
      console.error('[Monitoring] Error during Langfuse shutdown', { error });
    }
  }
}
