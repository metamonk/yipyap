# Follow-Up Work for Story 6.8: Edge Function Migration

**Parent Story:** Story 6.8 - Migrate Edge Functions to Cloud Functions
**Created:** 2025-10-26
**Status:** Planned

## Overview

Story 6.8 successfully migrated the **daily agent workflow** from Vercel Edge Functions to Firebase Cloud Functions, eliminating HTTP overhead and improving performance by 5-13 seconds per execution.

However, two AI features still use Vercel Edge Functions and the Vercel AI SDK:
1. **Voice training/matching**
2. **FAQ detection**

This document outlines the follow-up stories needed to complete the full migration.

---

## Follow-Up Story 1: Migrate Voice Training to OpenAI SDK

### Priority
**Medium** - Voice training runs infrequently (weekly/monthly), so HTTP overhead is less critical than daily agent workflow

### Scope

Migrate voice training and matching from Vercel AI SDK to direct OpenAI SDK calls:

**Files to Migrate:**
- `functions/src/ai/voiceTraining.ts` - Uses `@ai-sdk/openai` + `ai.generateText()`
- `functions/src/ai/voiceRetraining.ts` - Uses `@ai-sdk/openai` + `ai.generateText()`
- `functions/src/ai/voiceMatching.ts` - Uses `@ai-sdk/openai` + `ai.generateText()`

**Benefits:**
- Consistent AI SDK usage across all Cloud Functions
- Reduced dependencies (can fully remove Vercel AI SDK from `functions/package.json`)
- Simplified maintenance

**Effort Estimate:** 2-3 days

---

## Follow-Up Story 2: Migrate FAQ Detection from Edge Functions to Cloud Functions

### Priority
**Low** - FAQ detection is triggered on-demand (not part of scheduled workflows), HTTP overhead is acceptable for now

### Scope

Move FAQ detection endpoint from Vercel Edge Functions to Firebase Cloud Functions:

**Files to Migrate:**
- `api/detect-faq.ts` (Edge Function) → Move to `functions/src/faq/detect-faq.ts`
- `functions/src/ai/faqDetectionTrigger.ts` - Update to call local function instead of HTTP
- `functions/src/ai/faqEmbeddings.ts` - Migrate from `ai.embed()` to OpenAI SDK

**Files to Delete After Migration:**
- `api/detect-faq.ts`
- `api/utils/pineconeClient.ts` (if not used elsewhere)
- Remaining Edge Function infrastructure

**Environment Variables to Remove:**
- `EXPO_PUBLIC_VERCEL_EDGE_URL`
- `EXPO_PUBLIC_VERCEL_EDGE_TOKEN`
- `VERCEL_AUTOMATION_BYPASS_SECRET`

**Benefits:**
- Complete removal of Vercel Edge Functions infrastructure
- Simplified deployment pipeline (Firebase only)
- Consistent architecture (all AI processing in Cloud Functions)
- Can remove Vercel dependencies entirely

**Effort Estimate:** 3-4 days (includes Pinecone client migration and testing)

---

## Follow-Up Story 3: Remove Vercel AI SDK Dependency

### Priority
**Medium** - Should be done after Stories 1 and 2 are complete

### Scope

Complete cleanup after voice and FAQ migrations:

**Dependencies to Remove:**
- `@ai-sdk/openai` from `functions/package.json`
- `ai` from `functions/package.json`
- All Vercel-related packages from root `package.json`

**Documentation to Update:**
- `docs/architecture/ai-integration/ai-components.md` - Remove Edge Function references
- `docs/architecture/tech-stack.md` - Mark Vercel AI SDK as "Removed (Oct 2025)"
- `functions/README.md` - Update architecture diagrams
- `.env.example` - Remove Vercel environment variables

**Testing:**
- Verify all AI features work with OpenAI SDK only
- Run full regression test suite
- Verify no import errors for Vercel AI SDK

**Effort Estimate:** 1 day

---

## Total Estimated Effort

- **Story 1 (Voice Migration):** 2-3 days
- **Story 2 (FAQ Migration):** 3-4 days
- **Story 3 (Cleanup):** 1 day

**Total:** 6-8 days of development work

---

## Implementation Order

1. ✅ **Story 6.8 (Complete):** Daily agent workflow migration
2. **Story 6.9 (Proposed):** Voice training/matching migration
3. **Story 6.10 (Proposed):** FAQ detection migration
4. **Story 6.11 (Proposed):** Vercel AI SDK removal and final cleanup

---

## Benefits of Complete Migration

After all follow-up stories are complete:

1. **Simplified Stack:** Firebase-only infrastructure (no Vercel)
2. **Reduced Costs:** One less platform to pay for
3. **Consistent Architecture:** All AI processing in Cloud Functions
4. **Easier Maintenance:** Single SDK (OpenAI) for all AI features
5. **Better Performance:** No HTTP overhead for any AI operations

---

## Risks & Considerations

1. **Pinecone Client Migration:** FAQ detection uses Pinecone for vector search - need to ensure client works in Cloud Functions
2. **Environment Variables:** Need to carefully migrate secrets from Vercel to Firebase
3. **Testing:** Voice training and FAQ detection are harder to test than categorization (less frequent, more complex flows)
4. **Deployment Complexity:** May need to coordinate Vercel takedown with Firebase deployment

---

## References

- **Parent Story:** `/Users/zeno/Projects/yipyap/docs/stories/6.8.story.md`
- **Tech Stack Documentation:** `/Users/zeno/Projects/yipyap/docs/architecture/tech-stack.md`
- **Firebase Gen2 Caching Workaround:** `/Users/zeno/Projects/yipyap/docs/firebase-gen2-caching-workaround.md`
