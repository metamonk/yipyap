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

### Authentication Guards for Cross-User Operations

**CRITICAL PATTERN:** All AI services that write to user-specific Firestore subcollections MUST implement authentication guards to prevent permission errors when operations cross user boundaries.

**Common Scenario:** User A sends a message to User B. User B has auto-responses enabled. The AI service runs on User A's device (sender context) but might try to write to User B's (recipient) subcollections, causing permission errors.

**Solution Pattern:**

```typescript
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './firebase';

export async function myAIServiceFunction(targetUserId: string, ...otherParams): Promise<void> {
  try {
    // Authentication guard - only proceed if authenticated user matches target
    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== targetUserId) {
      // Graceful degradation - silently skip or return safe default
      return; // or return default value
    }

    // SAFE: currentUser matches targetUserId, proceed with Firestore writes
    const db = getFirestore(getFirebaseApp());
    await setDoc(doc(db, `users/${targetUserId}/ai_data`, 'someDoc'), {
      // ... your data
    });
  } catch (error) {
    console.error('[myAIService] Error:', error);
    // Handle gracefully
  }
}
```

**Services Using This Pattern:**

- `aiPerformanceService.ts` - trackOperationEnd()
- `aiRateLimitService.ts` - checkRateLimit(), incrementOperationCount()
- `aiCacheService.ts` - getCachedResult(), setCachedResult() (user-scoped paths)
- `aiAvailabilityService.ts` - checkUserBudgetStatus()

**Why This Matters:**

- Respects Firebase security rules (users can only write to their own subcollections)
- Prevents permission errors in cross-user scenarios
- Implements principle of least privilege
- Enables graceful degradation when authentication contexts don't match

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

  // 4. Track success (includes authentication guard internally)
  await trackOperationEnd(operationId, {
    userId: 'user123', // Will only track if currentUser.uid === 'user123'
    operation: 'your_operation_type',
    success: true,
    modelUsed: 'gpt-4o-mini',
    tokensUsed: {
      prompt: result.promptTokens,
      completion: result.completionTokens,
      total: result.totalTokens,
    },
    costCents: result.costCents,
    cacheHit: false,
  }).catch((error) => {
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
    cacheHit: false,
  }).catch(/* silent */);

  throw error;
}
```

### Adding Caching to AI Operations

For operations with repeated similar inputs, implement caching:

```typescript
import {
  generateCacheKey,
  getCachedResult,
  setCachedResult,
  isCachingEnabled,
} from './aiCacheService';

async function myAIOperation(userId: string, input: string) {
  // 1. Check if caching is enabled for this operation
  if (isCachingEnabled('your_operation')) {
    const cacheKey = generateCacheKey(input, 'your_operation');

    // 2. Try cache first (includes authentication guard internally)
    const cached = await getCachedResult(cacheKey, userId);
    if (cached) {
      // Track as cache hit
      trackOperationEnd(opId, { ...metrics, cacheHit: true, costCents: 0 });
      return cached;
    }
  }

  // 3. Cache miss - call AI
  const result = await callAI(input);

  // 4. Store in cache (includes authentication guard internally)
  if (cacheKey) {
    await setCachedResult(cacheKey, userId, 'your_operation', result);
  }

  return result;
}
```

**Important:** The cache service automatically serializes results to JSON strings to avoid Firestore's nested array limitations. Arrays within objects are supported through this serialization layer.

### Cache TTL Configuration

Add new operations to `services/aiCacheService.ts`:

```typescript
const CACHE_TTL_BY_OPERATION = {
  categorization: 24 * 60 * 60 * 1000, // 24 hours
  sentiment: 24 * 60 * 60 * 1000, // 24 hours
  faq_detection: 7 * 24 * 60 * 60 * 1000, // 7 days
  voice_matching: 30 * 60 * 1000, // 30 minutes
  opportunity_scoring: 24 * 60 * 60 * 1000, // 24 hours
  daily_agent: 0, // Never cache
  your_operation: 60 * 60 * 1000, // 1 hour (example)
} as const;
```

**TTL Guidelines:**

- **Static content** (FAQ templates, knowledge base): 7+ days
- **Stable patterns** (categorization, sentiment): 24 hours
- **Personalized content** (voice matching): 30 minutes
- **Always fresh** (daily agent, real-time data): TTL = 0 (no cache)

---
