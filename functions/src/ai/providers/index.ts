/**
 * AI provider exports and factory
 * @module functions/src/ai/providers
 */

import { OpenAIProvider } from './openai';
import type { AIProviderConfig, ModelConfig } from '../../types/ai';

// Export provider classes
export { OpenAIProvider } from './openai';

/**
 * Union type of all provider instances
 */
export type AIProvider = OpenAIProvider;

/**
 * Creates an AI provider instance based on configuration
 *
 * @param config - Provider configuration with API keys and settings
 * @returns Provider instance (OpenAI or Anthropic)
 * @throws {Error} When provider name is not supported
 *
 * @example
 * ```typescript
 * const config: AIProviderConfig = {
 *   name: 'openai',
 *   apiKey: 'sk-...',
 *   models: {
 *     fast: 'gpt-3.5-turbo',
 *     quality: 'gpt-4-turbo-preview',
 *     cost: 'gpt-3.5-turbo'
 *   }
 * };
 * const provider = createProvider(config);
 * ```
 */
export function createProvider(config: AIProviderConfig): AIProvider {
  if (config.name === 'openai') {
    return new OpenAIProvider(config.apiKey, config.baseURL);
  }
  throw new Error(`Unsupported AI provider: ${config.name}`);
}

/**
 * Checks if a provider is healthy and operational
 *
 * @param provider - Provider instance to check
 * @param testModelConfig - Model configuration for health check
 * @returns Promise resolving to true if provider is healthy, false otherwise
 *
 * @remarks
 * Performs a minimal test request to verify the provider is accessible.
 * Uses a very short prompt to minimize API costs during health checks.
 *
 * @example
 * ```typescript
 * const provider = createProvider(openaiConfig);
 * const modelConfig: ModelConfig = {
 *   provider: 'openai',
 *   model: 'gpt-3.5-turbo',
 *   config: { maxTokens: 10, temperature: 0 }
 * };
 * const isHealthy = await checkProviderHealth(provider, modelConfig);
 * if (!isHealthy) {
 *   console.error('Provider health check failed');
 * }
 * ```
 */
export async function checkProviderHealth(
  provider: AIProvider,
  testModelConfig: ModelConfig
): Promise<boolean> {
  try {
    const result = await provider.generateText(testModelConfig, 'Test');

    // Health check passes if operation succeeds (regardless of output)
    return result.success;
  } catch (error) {
    console.error('[Provider Health Check] Failed', { error });
    return false;
  }
}
