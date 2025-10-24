# AI Infrastructure - Phase 2

## Overview

This directory contains the AI provider abstraction layer for yipyap's Phase 2 AI intelligence features. The infrastructure provides a unified interface for OpenAI with comprehensive error handling, model degradation fallback, and monitoring.

## Architecture

### Components

1. **AIService** (`aiService.ts`) - Main orchestration layer
   - Automatic model selection based on criteria (speed/quality/cost)
   - Model degradation fallback (Quality → Cost-optimized)
   - Circuit breaker pattern (threshold: 10 failures, cooldown: 60s)
   - Feature flag support for graceful degradation

2. **Providers** (`providers/`) - AI provider implementations
   - **OpenAI**: GPT-4o-mini for speed/cost operations, GPT-4 Turbo for quality
   - Retry logic with exponential backoff (3 retries: 1s, 2s, 4s)
   - Comprehensive error categorization

3. **Model Selector** (`modelSelector.ts`) - Routing logic
   - Speed priority → GPT-4o-mini
   - Quality priority → GPT-4 Turbo
   - Cost priority → GPT-4o-mini (reduced tokens)

4. **Monitoring** (`monitoring.ts`) - Observability
   - Langfuse integration for LLM observability
   - Cost tracking with model-specific pricing
   - Firebase Cloud Logging integration

5. **Rate Limiter** (`rateLimiter.ts`) - Cost control
   - Upstash Redis-based distributed rate limiting
   - Sliding window algorithm
   - Per-operation limits (categorization: 200/hr, generation: 50/hr)

## Model Selection Strategy

Based on operation requirements:

| Priority | Provider | Model | Use Case | Cost (per 1M tokens) |
|----------|----------|-------|----------|----------------------|
| **Speed** | OpenAI | GPT-4o-mini | Real-time categorization | $0.15 / $0.60 (in/out) |
| **Quality** | OpenAI | GPT-4 Turbo | Response generation | $10.00 / $30.00 (in/out) |
| **Cost** | OpenAI | GPT-4o-mini (reduced tokens) | High-volume operations | $0.15 / $0.60 (in/out) |

## Error Handling

All AI operations implement comprehensive error handling:

### Error Types

- **network**: Retryable - Connection issues, timeouts
- **auth**: Not retryable - Invalid API keys
- **rate_limit**: Retryable - Rate limit exceeded
- **validation**: Not retryable - Invalid input
- **provider**: Retryable - Service unavailable
- **unknown**: Retryable - Unexpected errors

### Retry Strategy

- **Max retries**: 3 (vs 5 for standard operations)
- **Backoff delays**: [1000ms, 2000ms, 4000ms]
- **Rationale**: Fewer retries due to AI provider timeout constraints (30s OpenAI)

### Fallback Mechanism

If quality model fails:
1. Check circuit breaker status
2. Attempt model degradation to cost-optimized model (GPT-4o-mini)
3. Update circuit breaker state
4. Log operation details

## Initialization

**IMPORTANT:** Initialize AI services once during Cloud Function cold start:

```typescript
import { initializeAI } from './ai';

// Call once during function initialization
initializeAI();
```

This initializes:
- **Langfuse** monitoring client
- **Upstash Redis** rate limiter

Services gracefully degrade if credentials are missing.

## Usage Example

```typescript
import { AIService, initializeAI } from './ai';

// Initialize AI infrastructure (call once on cold start)
initializeAI();

// Create AI service instance
const service = new AIService({
  openai: {
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    models: {
      fast: 'gpt-4o-mini',
      quality: 'gpt-4-turbo-preview',
      cost: 'gpt-4o-mini',
    },
  },
}, true); // aiEnabled flag

// Process request
const result = await service.processRequest(
  { priority: 'speed', maxTokens: 1000 },
  'Categorize this message: Hello world'
);

if (result.success) {
  console.log('Generated text:', result.data);
  console.log('Tokens used:', result.tokensUsed);
  console.log('Latency:', result.latency, 'ms');
} else {
  console.error('Error:', result.error);
}
```

## Environment Variables

Required configuration (set in `.env` file):

```bash
# OpenAI
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key
EXPO_PUBLIC_OPENAI_ORG_ID=your_org_id (optional)

# Vercel Edge Functions
EXPO_PUBLIC_VERCEL_EDGE_URL=https://your-project.vercel.app/api
EXPO_PUBLIC_VERCEL_EDGE_TOKEN=your_vercel_edge_token

# Feature Flags
EXPO_PUBLIC_AI_ENABLED=true

# Monitoring (optional but recommended)
EXPO_PUBLIC_LANGFUSE_PUBLIC_KEY=your_public_key
EXPO_PUBLIC_LANGFUSE_SECRET_KEY=your_secret_key
EXPO_PUBLIC_LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Rate Limiting (recommended for production)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

## Testing

### Unit Tests

Located in `functions/tests/unit/ai/`:
- `modelSelector.test.ts` - Model selection logic
- `providers/openai.test.ts` - OpenAI provider
- `aiService.test.ts` - Main service orchestration

Run with:
```bash
cd functions
npm test -- --testPathPattern="tests/unit/ai"
```

### Integration Tests

Located in `functions/tests/integration/ai/`:
- Require real API key: `OPENAI_TEST_API_KEY`
- Incur small costs (~$0.01 per run)
- Skip with: `SKIP_INTEGRATION_TESTS=1 npm test`

## Cost Management

### Rate Limiting

Prevents runaway costs:
- Default: 100 requests/hour per user
- Categorization: 200 requests/hour
- Generation: 50 requests/hour
- Configurable in `rateLimiter.ts`

### Monitoring

Track costs in real-time:
```typescript
import { trackCost } from './ai/monitoring';

const cost = trackCost('gpt-4-turbo-preview', 1000, 'user123');
console.log(`Estimated cost: $${cost.toFixed(4)}`);
```

## Future Stories

This infrastructure supports upcoming features:
- **Story 5.2**: Message Categorization
- **Story 5.3**: Sentiment Analysis
- **Story 5.4**: Suggested Responses
- **Story 5.5**: Opportunity Scoring

## Troubleshooting

### AI Disabled Error

```
{ code: 'AI_DISABLED', message: 'AI features are currently disabled' }
```

**Solution**: Set `EXPO_PUBLIC_AI_ENABLED=true` in `.env`

### Authentication Errors

```
{ code: 'AUTH_ERROR', type: 'auth', retryable: false }
```

**Solution**: Verify API keys are correct and active

### Rate Limit Exceeded

```
{ code: 'RATE_LIMIT_EXCEEDED', type: 'rate_limit', retryable: true }
```

**Solution**: Wait for rate limit window to reset (check `getRateLimitStatus()`)

### Circuit Breaker Open

Provider temporarily disabled after 10 consecutive failures. Cooldown: 60 seconds.

**Solution**: Wait for cooldown period, or check provider health

## References

- [Architecture: Tech Stack](../../../docs/architecture/tech-stack.md)
- [Architecture: Coding Standards](../../../docs/architecture/coding-standards.md)
- [Story 5.1: AI Infrastructure Foundation](../../../docs/stories/5.1.story.md)
