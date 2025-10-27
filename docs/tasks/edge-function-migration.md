# Task: Migrate Edge Functions to Cloud Functions

## Overview
Migrate AI processing logic from Vercel Edge Functions to Firebase Cloud Functions to eliminate HTTP overhead and improve workflow performance.

## Current Architecture
```
Cloud Function → HTTP → Vercel Edge Function → OpenAI API
                 ↓
            100-300ms network latency per request
```

## Target Architecture
```
Cloud Function → OpenAI API (direct)
       ↓
  No HTTP overhead
```

## Scope

### Edge Functions to Migrate
1. **`api/categorize-message.ts`** - Message categorization, sentiment analysis, opportunity scoring
2. **`api/detect-faq.ts`** - FAQ detection and matching

### Dependencies to Replace
- `@ai-sdk/openai` (Vercel AI SDK) → `openai` (official OpenAI SDK)
- `ai` (Vercel AI package) → Direct OpenAI API calls
- `api/utils/aiClient.ts` → Migrate to `functions/src/ai/aiClient.ts`

## Expected Impact
- **Performance:** Save 5-13 seconds per workflow execution (100 messages)
- **Reliability:** Reduce points of failure (no HTTP dependency)
- **Cost:** Slightly lower (fewer network hops)
- **Debugging:** Simpler stack traces, unified logging

## Implementation Steps

1. **Create `functions/src/ai/categorization.ts`**
   - Port categorization logic from `api/utils/aiClient.ts`
   - Replace Vercel AI SDK with OpenAI SDK
   - Maintain identical prompt and response format

2. **Create `functions/src/ai/faq-detection.ts`**
   - Port FAQ detection logic
   - Implement embedding search
   - Maintain confidence scoring logic

3. **Update `daily-agent-workflow.ts`**
   - Remove `fetch()` calls to Edge Functions
   - Import and call local categorization/FAQ functions directly
   - Update error handling for direct calls

4. **Testing**
   - Unit tests for categorization parity
   - Unit tests for FAQ detection parity
   - Integration test with full workflow
   - Compare outputs before/after migration

5. **Cleanup**
   - Remove unused Edge Function files (or keep as backup)
   - Update environment variables
   - Update deployment documentation

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Behavioral differences in AI responses | Side-by-side comparison testing, same prompts |
| OpenAI SDK differences from Vercel SDK | Review SDK docs, test all features |
| Increased Cloud Function memory usage | Monitor memory, adjust if needed |
| Breaking existing workflows | Deploy as V4 functions, test before switching |

## Acceptance Criteria
- [ ] Categorization produces identical results to Edge Function
- [ ] FAQ detection produces identical results to Edge Function
- [ ] Workflow execution time reduces by 5-13 seconds
- [ ] No increase in error rates
- [ ] All existing tests pass
- [ ] Performance monitoring shows improvement

## Effort Estimate
- **Development:** 2 days
- **Testing:** 1 day
- **Total:** 3 days

## Priority
P2 (Medium) - Good performance win, but not critical since we've already achieved 50% speedup with other optimizations.

## Related Documents
- Performance recommendations: `docs/performance-recommendations.md`
- Tech stack: `architecture/tech-stack.md`
- Deployment guide: `functions/README.md`
