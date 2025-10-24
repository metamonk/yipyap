/**
 * AI service module exports
 * @module functions/src/ai
 */

// Initialization
export { initializeAI } from './initialize';

// Main service
export { AIService } from './aiService';

// Model selection
export { selectModel } from './modelSelector';

// Providers
export { OpenAIProvider, createProvider, checkProviderHealth } from './providers';
export type { AIProvider } from './providers';

// Monitoring
export { initLangfuse, logAIOperation, trackCost, shutdownMonitoring } from './monitoring';

// Rate limiting
export { initRateLimiter, checkRateLimit, getRateLimitStatus, resetRateLimit } from './rateLimiter';
