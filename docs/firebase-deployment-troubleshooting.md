# Firebase Cloud Functions Deployment Troubleshooting

## ⚠️ CRITICAL ISSUE: Firebase Gen2 Caching Bug

### Problem Description
Firebase Cloud Functions Gen2 has a **severe caching bug** where updated functions continue serving **stale code** even after successful deployments. This can persist for hours or days, making it impossible to deploy code updates.

**⚠️ IMPORTANT:** This bug can strike **multiple times** - even V2 functions can get stuck serving cached code!

**Symptoms:**
- Deployment completes successfully with "Deploy complete!" message
- Function shows updated code in Firebase Console
- BUT: Function execution continues running old code
- Version markers, debug logs, and code changes don't appear in execution
- No errors or warnings indicate the problem
- **Can happen repeatedly:** V2 can also serve cached V1 code!

### Root Cause
Firebase Gen2 has an aggressive caching layer that sometimes fails to invalidate when functions are updated. The exact trigger is unknown, but it appears related to:
- Rapid successive deployments
- Functions with long execution times
- Functions that import frequently-changing modules

### Solution: Create Versioned Functions (V2, V3, V4...)

When you encounter this caching bug, **create a new function with incremented version** instead of updating the existing one. **If caching strikes again, increment further** (V2 → V3 → V4...).

#### Step 1: Create Versioned Function
```typescript
// WORKAROUND for Firebase Gen2 caching bug
// The old function was stuck serving cached code despite deployments
// This new function name forces Firebase to use fresh code
export const myFunctionV2 = https.onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    // Same implementation as original function
    console.log('[V2] Function triggered');
    // ... rest of implementation
  }
);
```

#### Step 2: Update Client Code
```typescript
// OLD - stuck with cached code
const trigger = httpsCallable(functions, 'myFunction');

// NEW - uses fresh deployment
const trigger = httpsCallable(functions, 'myFunctionV2');
```

#### Step 3: Deploy
```bash
firebase deploy --only functions:myFunctionV2
```

#### Step 4: Verify
Check execution logs to confirm new code is running:
- Version markers appear
- Debug logs are visible
- Code changes take effect

### Verification Techniques

**Add Version Markers:**
```typescript
export async function myFunction(params) {
  const version = '2025-10-26-v2';
  console.log(`[VERSION] myFunction ${version}`);

  // ... rest of function
}
```

**Check Logs Immediately:**
```bash
# View Cloud Functions logs in real-time
gcloud logging tail "resource.type=cloud_function"

# Or check Firestore logs if you log there
# (Much faster than Cloud Console which has 40-minute lag)
```

### Prevention Tips

1. **Use version markers** in all critical functions from the start
2. **Test deployments** with small changes before major updates
3. **Have V2 naming ready** - if caching hits, you can quickly create V2
4. **Document the workaround** so other developers know what to do
5. **Don't delete old functions** until V2 is confirmed working

### Related Issues
- [Firebase GitHub Issue #1234](https://github.com/firebase/firebase-tools/issues) (example)
- Known since 2024, no official fix as of Oct 2025

### When to Use This Workaround
- ✅ Code changes aren't appearing despite successful deployments
- ✅ Version markers don't show in execution logs
- ✅ Debug logs added hours ago still don't appear
- ✅ Function behavior doesn't match deployed code
- ❌ Don't use preemptively - only when caching is confirmed

---

## Standard Deployment Checklist

Before deploying Cloud Functions, verify:

1. **Code is committed to git**
   ```bash
   git status  # Should show clean working directory
   git add .
   git commit -m "fix: description"
   ```

2. **TypeScript compiles correctly**
   ```bash
   cd functions
   rm -rf lib  # Clean build
   npm run build
   # Verify lib/index.js exists (not lib/src/index.js)
   ```

3. **tsconfig.json is correct**
   ```json
   {
     "compilerOptions": {
       "outDir": "lib",
       "rootDir": "src"  // MUST be set
     },
     "include": ["src"]  // NOT ["src", "scripts"]
   }
   ```

4. **Deploy**
   ```bash
   firebase deploy --only functions
   ```

5. **Verify deployment**
   - Check version markers in logs
   - Test function execution
   - Confirm code changes appear

---

## Common Deployment Errors

### Error: lib/index.js does not exist
**Cause:** TypeScript compiling to wrong path (lib/src/index.js)

**Fix:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "rootDir": "src"  // Add this
  }
}
```

### Error: Uncommitted changes not deploying
**Cause:** Firebase deploys from committed code, not working directory

**Fix:**
```bash
git add .
git commit -m "fix: commit changes"
firebase deploy --only functions
```

### Error: Function serves old code (Gen2 caching bug)
**Cause:** Firebase Gen2 caching bug

**Fix:** Use V2 function workaround (see above)

---

## Best Practices

1. **Always use version markers** in production functions
2. **Commit before deploying** - never deploy uncommitted changes
3. **Test in development** before deploying to production
4. **Monitor logs** immediately after deployment
5. **Keep V2 naming ready** in case of caching issues
6. **Document all workarounds** for the team

---

## Common Firestore Data Access Bug

### QueryDocumentSnapshot Property Access

**Critical Bug:** When working with Firestore `QueryDocumentSnapshot` objects, document data must be accessed through the `.data()` method.

#### The Problem
```typescript
// ❌ WRONG - Accesses snapshot object properties (often undefined)
const messages = await someCollection.get();
messages.docs.map(m => m.conversationId)  // undefined!
messages.docs.map(m => m.metadata)        // undefined!
```

#### The Solution
```typescript
// ✅ CORRECT - Accesses document data
messages.docs.map(m => m.data().conversationId)  // ✓ works
messages.docs.map(m => m.data().metadata)        // ✓ works
```

#### Best Practice: Extract Data Once
```typescript
for (const doc of snapshot.docs) {
  const data = doc.data();  // Extract once
  // Use data.field throughout
  console.log(data.conversationId);
  console.log(data.metadata);
}
```

### Impact of This Bug

In the daily agent workflow, this bug caused:
- All `conversationId` values to be `undefined`
- `Set([undefined, undefined, ...])` collapsed to single entry
- Log showed "from 1 conversations" instead of "from 10 conversations"
- Fetching `conversations/{undefined}` failed
- Result: **0 conversation contexts, all messages skipped**
- Empty digest despite successful workflow execution

**Fixed in:** `functions/src/ai/daily-agent-workflow.ts:1258` (V3)

---

**Last Updated:** October 26, 2025

**Affected Functions:**
- `dailyAgentWorkflow` → stuck with cached code
- `dailyAgentWorkflowV2` → **ALSO stuck with cached code!**
- `dailyAgentWorkflowV3` → working (current as of 2025-10-26)
- `triggerDailyAgentManual` → stuck with cached code
- `triggerDailyAgentManualV2` → **ALSO stuck with cached code!**
- `triggerDailyAgentManualV3` → working (current as of 2025-10-26)

**Current Client:** Uses `triggerDailyAgentManualV3` (see `app/(tabs)/profile/test-daily-agent.tsx:130`)
