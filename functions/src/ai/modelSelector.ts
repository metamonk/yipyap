/**
 * Model selection logic for routing AI operations to appropriate providers
 * @module functions/src/ai/modelSelector
 */

import type { ModelSelectionCriteria, ModelConfig } from '../types/ai';

/**
 * Selects appropriate AI model based on operation criteria
 *
 * @param criteria - Selection criteria (speed/quality/cost priority)
 * @returns Model configuration for the selected provider
 *
 * @remarks
 * Model selection strategy (OpenAI-only):
 * - Speed priority: GPT-4o-mini (fastest response, sub-second latency)
 * - Quality priority: GPT-4 Turbo (best-in-class accuracy and reasoning)
 * - Cost priority: GPT-4o-mini with reduced tokens (most economical)
 *
 * Cost comparison:
 * - GPT-4o-mini: $0.15/$0.60 per 1M tokens (input/output)
 * - GPT-4 Turbo: $10.00/$30.00 per 1M tokens (input/output)
 *
 * @example
 * ```typescript
 * // Speed priority for real-time categorization
 * const speedModel = selectModel({ priority: 'speed' });
 * // Returns: { provider: 'openai', model: 'gpt-4o-mini', config: { maxTokens: 1000, temperature: 0.7 } }
 *
 * // Quality priority for response generation
 * const qualityModel = selectModel({ priority: 'quality', maxTokens: 2000 });
 * // Returns: { provider: 'openai', model: 'gpt-4-turbo-preview', config: { maxTokens: 2000, temperature: 0.8 } }
 *
 * // Cost priority for high-volume operations
 * const costModel = selectModel({ priority: 'cost' });
 * // Returns: { provider: 'openai', model: 'gpt-4o-mini', config: { maxTokens: 500, temperature: 0.5 } }
 * ```
 */
export function selectModel(criteria: ModelSelectionCriteria): ModelConfig {
  // Speed priority: Use GPT-4o-mini for fastest response
  if (criteria.priority === 'speed') {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      config: {
        maxTokens: criteria.maxTokens ?? 1000,
        temperature: criteria.temperature ?? 0.7,
      },
    };
  }

  // Quality priority: Use GPT-4 Turbo for best accuracy
  if (criteria.priority === 'quality') {
    return {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      config: {
        maxTokens: criteria.maxTokens ?? 2000,
        temperature: criteria.temperature ?? 0.8,
      },
    };
  }

  // Cost priority: Use GPT-4o-mini with reduced tokens
  if (criteria.priority === 'cost') {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      config: {
        maxTokens: criteria.maxTokens ?? 500,
        temperature: criteria.temperature ?? 0.5,
      },
    };
  }

  // Default fallback (should never reach here with proper typing)
  throw new Error(`Invalid priority: ${criteria.priority}`);
}
