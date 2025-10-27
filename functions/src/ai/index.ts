/**
 * AI service module exports
 * @module functions/src/ai
 *
 * Note: Provider abstraction (AIService, initialize, providers) removed in Story 6.11
 * All AI operations now use direct OpenAI SDK calls for simplicity
 */

// Model selection
export { selectModel } from './modelSelector';

// Monitoring
export { initLangfuse, logAIOperation, trackCost, shutdownMonitoring } from './monitoring';

// Rate limiting
export { initRateLimiter, checkRateLimit, getRateLimitStatus, resetRateLimit } from './rateLimiter';
