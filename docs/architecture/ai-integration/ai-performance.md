# Performance and Optimization

## Performance Targets

| Operation              | Target Latency | Optimization Strategy       |
| ---------------------- | -------------- | --------------------------- |
| Message Categorization | <500ms         | Edge Functions, caching     |
| Sentiment Analysis     | <300ms         | Bundled with categorization |
| FAQ Detection          | <400ms         | In-memory pattern matching  |
| Response Generation    | <3s            | Streaming responses         |
| Daily Agent            | <60s           | Batch processing            |

## Cost Optimization

**Model Selection by Use Case:**

- High-volume operations → Cheapest model (Gemini Flash Lite)
- Quality-critical → Premium models (Claude-3-Opus)
- Real-time → Fast models (GPT-4-Turbo)

**Cost Controls:**

- Daily spend limits per creator ($5 default)
- Alert at 80% budget consumption
- Automatic fallback to manual mode at limit

---

## Integration Patterns for Developers

### Adding Performance Tracking to New AI Operations

When adding new AI operations, use this pattern to ensure consistent performance monitoring:

```typescript
// 1. Import tracking functions
import { trackOperationStart, trackOperationEnd } from './aiPerformanceService';

// 2. Start tracking before AI call
const operationId = `{operation_type}_{unique_id}_${Date.now()}`;
trackOperationStart(operationId, 'your_operation_type');

try {
  // 3. Call your AI operation
  const result = await callYourAIService();

  // 4. Track success
  await trackOperationEnd(operationId, {
    userId: 'user123',
    operation: 'your_operation_type',
    success: true,
    modelUsed: 'gpt-4o-mini',
    tokensUsed: {
      prompt: result.promptTokens,
      completion: result.completionTokens,
      total: result.totalTokens
    },
    costCents: result.costCents,
    cacheHit: false
  }).catch(error => {
    console.error('Failed to track performance:', error);
  });

  return result;
} catch (error) {
  // 5. Track failure
  await trackOperationEnd(operationId, {
    userId: 'user123',
    operation: 'your_operation_type',
    success: false,
    errorType: 'network', // or 'timeout', 'rate_limit', 'model_error', 'unknown'
    modelUsed: 'gpt-4o-mini',
    tokensUsed: { prompt: 0, completion: 0, total: 0 },
    costCents: 0,
    cacheHit: false
  }).catch(/* silent */);

  throw error;
}
```

### Adding Caching to AI Operations

For operations with repeated similar inputs, implement caching:

```typescript
import { generateCacheKey, getCachedResult, setCachedResult, isCachingEnabled } from './aiCacheService';

async function myAIOperation(userId: string, input: string) {
  // 1. Check if caching is enabled for this operation
  if (isCachingEnabled('your_operation')) {
    const cacheKey = generateCacheKey(input, 'your_operation');

    // 2. Try cache first
    const cached = await getCachedResult(cacheKey, userId);
    if (cached) {
      // Track as cache hit
      trackOperationEnd(opId, { ...metrics, cacheHit: true, costCents: 0 });
      return cached;
    }
  }

  // 3. Cache miss - call AI
  const result = await callAI(input);

  // 4. Store in cache
  if (cacheKey) {
    await setCachedResult(cacheKey, userId, 'your_operation', result);
  }

  return result;
}
```

### Cache TTL Configuration

Add new operations to `services/aiCacheService.ts`:

```typescript
const CACHE_TTL_BY_OPERATION = {
  categorization: 24 * 60 * 60 * 1000,      // 24 hours
  sentiment: 24 * 60 * 60 * 1000,           // 24 hours
  faq_detection: 7 * 24 * 60 * 60 * 1000,   // 7 days
  voice_matching: 30 * 60 * 1000,           // 30 minutes
  opportunity_scoring: 24 * 60 * 60 * 1000, // 24 hours
  daily_agent: 0,                           // Never cache
  your_operation: 60 * 60 * 1000,           // 1 hour (example)
} as const;
```

**TTL Guidelines:**
- **Static content** (FAQ templates, knowledge base): 7+ days
- **Stable patterns** (categorization, sentiment): 24 hours
- **Personalized content** (voice matching): 30 minutes
- **Always fresh** (daily agent, real-time data): TTL = 0 (no cache)

---
