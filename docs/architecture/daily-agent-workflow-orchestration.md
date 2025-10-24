# Daily Agent Workflow Orchestration

**Story 5.8 - Multi-Step Daily Agent**

This document provides a comprehensive guide to the Daily Agent workflow orchestration, including detailed step-by-step execution flow, error handling, and integration verification.

---

## Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [Execution Trigger](#execution-trigger)
3. [Pre-Flight Checks](#pre-flight-checks)
4. [Step-by-Step Execution](#step-by-step-execution)
5. [Error Handling & Rollback](#error-handling--rollback)
6. [Performance Tracking](#performance-tracking)
7. [Integration Verification](#integration-verification)
8. [Execution Logging](#execution-logging)

---

## Workflow Overview

The Daily Agent workflow orchestrates 5 sequential steps to process overnight messages and generate a daily digest:

```
┌─────────────────────────────────────────────────┐
│  Daily Agent Workflow Orchestration             │
└─────────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Pre-Flight Checks   │ ◄── IV3: Online/Active Check
   └──────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Step 1: Fetch       │ ◄── IV1: Skip Active Conversations
   │  Unprocessed         │
   │  Messages            │
   └──────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Step 2: Categorize  │ ◄── Edge Function (GPT-4o-mini)
   │  Messages            │
   └──────────────────────┘
              │
              ▼ (Timeout Check)
              │
   ┌──────────────────────┐
   │  Step 3: Detect FAQs │ ◄── IV2: Manual Override Check
   │  & Auto-Respond      │
   └──────────────────────┘
              │
              ▼ (Timeout Check)
              │
   ┌──────────────────────┐
   │  Step 4: Draft       │
   │  Voice-Matched       │
   │  Responses           │
   └──────────────────────┘
              │
              ▼ (Timeout Check)
              │
   ┌──────────────────────┐
   │  Step 5: Generate    │ ◄── Push Notification
   │  Daily Digest        │
   └──────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Save Metrics &      │
   │  Mark Complete       │
   └──────────────────────┘
```

---

## Execution Trigger

### Cloud Function Entry Point

```typescript
export const dailyAgentWorkflow = functions.onCall(
  { timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new functions.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const result = await orchestrateWorkflow(userId);
    return result;
  }
);
```

**Function Configuration**:
- **Timeout**: 540 seconds (9 minutes)
- **Memory**: 1 GiB
- **Trigger**: HTTP callable (authenticated)
- **Invoked By**: Cloud Scheduler (hourly) or manual client call

### Cloud Scheduler Job

**Schedule**: Every hour on the hour (`0 * * * *` cron)

**Invocation Logic**:
1. Scheduler runs every hour (e.g., 08:00, 09:00, 10:00 UTC)
2. For each user with `scheduleSettings.enabled = true`:
   - Calculate current time in user's timezone
   - Check if current time is within 5 minutes of `scheduleSettings.scheduleTime`
   - If match, invoke `dailyAgentWorkflow(userId)`

**Example**:
- Scheduler runs at `17:00 UTC`
- User's timezone: `America/Los_Angeles` (UTC-8)
- User's local time: `09:00 PST`
- User's schedule time: `09:00`
- **Result**: Workflow triggered ✅

---

## Pre-Flight Checks

### 1. Load User Configuration

**Location**: `functions/src/ai/daily-agent-workflow.ts:1041-1057`

```typescript
const configDoc = await db
  .collection('users')
  .doc(userId)
  .collection('ai_workflow_config')
  .doc(userId)
  .get();

const config = configDoc.exists ? configDoc.data() : DEFAULT_CONFIG;
```

**Loaded Configuration**:
- `maxAutoResponses`: Maximum FAQ responses per execution
- `requireApproval`: Whether responses need manual approval
- `escalationThreshold`: Sentiment score for crisis escalation
- `activeThresholdMinutes`: Minutes to consider user "active"

**Default Fallback**:
If no configuration exists, uses:
```typescript
{
  maxAutoResponses: 20,
  requireApproval: true,
  escalationThreshold: 0.3,
  activeThresholdMinutes: 30,
}
```

---

### 2. IV3: Online/Active Status Check

**Location**: `functions/src/ai/daily-agent-workflow.ts:1057-1110`

**Purpose**: Skip workflow if user is currently active to avoid disrupting real-time conversations.

**Logic**:
```typescript
const isActive = await isUserOnlineOrActive(userId, activeThresholdMinutes);

if (isActive) {
  // Create "skipped" execution document
  // Return early without processing
}
```

**User Considered Active If**:
1. `user.presence.status === 'online'` (explicit online status), OR
2. `user.presence.lastSeen` is within last N minutes (default: 30)

**Skip Behavior**:
- Execution document created with `status: 'skipped'`
- Reason logged: "Creator is currently online/active"
- All result counters set to 0
- No cost incurred

**Example Execution Document**:
```typescript
{
  id: "exec_1234567890_user123",
  userId: "user123",
  status: "skipped",
  results: {
    messagesFetched: 0,
    messagesCategorized: 0,
    // ... all zeros
  },
  digestSummary: "Skipped: Creator is currently online/active",
}
```

---

### 3. Initialize Workflow Context

**Location**: `functions/src/ai/daily-agent-workflow.ts:1112-1151`

```typescript
const ctx: WorkflowContext = {
  userId,
  executionId: `exec_${Date.now()}_${userId}`,
  startTime: admin.firestore.Timestamp.now(),
  config: config.workflowSettings,
  results: {
    messagesFetched: 0,
    messagesCategorized: 0,
    faqsDetected: 0,
    autoResponsesSent: 0,
    responsesDrafted: 0,
    messagesNeedingReview: 0,
  },
  costs: {
    categorization: 0,
    faqDetection: 0,
    responseGeneration: 0,
    total: 0,
  },
};
```

**Context Purpose**:
- Passed to all workflow step functions
- Tracks execution state and metrics
- Updated incrementally as steps complete
- Saved to Firestore at end of execution

---

### 4. Create Execution Document

**Location**: `functions/src/ai/daily-agent-workflow.ts:1153-1170`

```typescript
await db
  .collection('users')
  .doc(userId)
  .collection('daily_executions')
  .doc(executionId)
  .set({
    id: executionId,
    userId,
    executionDate: admin.firestore.FieldValue.serverTimestamp(),
    status: 'running',
    results: ctx.results,
    metrics: {
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      endTime: null,
      duration: 0,
      costIncurred: 0,
    },
    steps: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
```

**Purpose**:
- Track workflow progress in real-time
- Allow UI to display "running" status
- Provide audit trail for debugging

---

## Step-by-Step Execution

### Step 1: Fetch Unprocessed Messages

**Function**: `fetchUnprocessedMessages(userId, ctx)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:197-290`

**Purpose**: Retrieve messages from last 12 hours that need AI processing.

**Execution Flow**:

1. **Calculate Time Window**:
   ```typescript
   const now = admin.firestore.Timestamp.now();
   const twelveHoursAgo = new Timestamp(now.seconds - 12 * 60 * 60, now.nanoseconds);
   const oneHourAgo = new Timestamp(now.seconds - 60 * 60, now.nanoseconds);
   ```

2. **Fetch User's Conversations**:
   ```typescript
   const conversationsSnap = await db
     .collection('conversations')
     .where('creatorId', '==', userId)
     .get();
   ```

3. **For Each Conversation**:
   - **IV1 Check**: Skip if `lastMessageTimestamp > oneHourAgo` (active conversation)
   - Fetch messages from last 12 hours where `senderId != userId`
   - Filter out already processed messages (unless `pendingReview: true`)
   - Filter out crisis messages (`sentimentScore < escalationThreshold`)

4. **Update Context**:
   ```typescript
   ctx.results.messagesFetched = messages.length;
   ```

**Performance Tracking**:
- Duration measured: `Date.now() - stepStart`
- Logged via `trackStepPerformance(ctx, 'fetch', stepDuration)`
- Warning if > 30 seconds

**Filters Applied**:
| Filter | Condition | Reason |
|--------|-----------|--------|
| Time range | `timestamp >= twelveHoursAgo` | Only recent messages |
| Sender | `senderId != userId` | Only incoming messages |
| Active conversation | `lastMessageTimestamp < oneHourAgo` | IV1: Skip real-time chats |
| Already processed | `!metadata.aiProcessed OR metadata.pendingReview` | Avoid duplicate work |
| Crisis messages | `sentimentScore >= escalationThreshold` | Require human attention |

**Example Output**:
- 100 messages fetched
- 20 filtered out (active conversations)
- 10 filtered out (crisis messages)
- **70 messages** passed to Step 2

**Early Exit**:
If `messages.length === 0`:
- Workflow completes immediately
- Execution marked `status: 'completed'`
- Digest summary: `"0 handled, 0 need review"`

---

### Step 2: Categorize Messages

**Function**: `categorizeMessages(messages, ctx)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:305-390`

**Purpose**: Categorize each message using GPT-4o-mini via Edge Function.

**Execution Flow**:

1. **Batch Configuration**:
   ```typescript
   const batchSize = 50;
   const edgeFunctionUrl = process.env.VERCEL_URL
     ? `https://${process.env.VERCEL_URL}/api/categorize-message`
     : 'http://localhost:3000/api/categorize-message';
   ```

2. **Batch Processing Loop**:
   ```typescript
   for (let i = 0; i < messages.length; i += batchSize) {
     const batch = messages.slice(i, i + batchSize);
     await Promise.all(
       batch.map(async (msgDoc) => {
         // Categorize each message in parallel
       })
     );
   }
   ```

3. **For Each Message**:
   - Call Edge Function `POST /api/categorize-message`
   - Receive category (e.g., "question", "request", "feedback")
   - Update message metadata:
     ```typescript
     await msgDoc.ref.update({
       'metadata.category': result.category,
       'metadata.aiProcessed': true,
       'metadata.aiProcessedAt': admin.firestore.FieldValue.serverTimestamp(),
     });
     ```

4. **Cost Tracking**:
   ```typescript
   categoryCost += result.cost || 0.05; // $0.05 per message
   ctx.costs.categorization = categoryCost;
   ctx.costs.total += categoryCost;
   ```

**Performance Optimization**:
- **Batch size**: 50 messages per batch
- **Parallelization**: All messages in batch processed simultaneously
- **Benefit**: 10x faster than sequential processing

**Performance Tracking**:
- Duration measured and logged
- Warning if > 60 seconds

**Error Handling**:
- Individual message failures logged but don't stop workflow
- Continues with remaining messages
- `ctx.results.messagesCategorized` tracks successful categorizations

**Example**:
- 70 messages to categorize
- Batch 1: 50 messages (parallel)
- Batch 2: 20 messages (parallel)
- Total time: ~45 seconds (vs. 450 seconds sequential)
- Cost: 70 × $0.05 = $3.50

---

### Timeout Check #1

**Location**: `functions/src/ai/daily-agent-workflow.ts:1182-1187`

```typescript
if (isWorkflowTimedOut(ctx)) {
  throw new Error('Workflow timeout: exceeded 5 minute limit after categorization');
}
```

**Purpose**: Abort workflow if total execution time > 5 minutes.

**Timeout Calculation**:
```typescript
const elapsed = (now.seconds - ctx.startTime.seconds) * 1000;
return elapsed > WORKFLOW_TIMEOUT_MS; // 5 minutes = 300,000ms
```

**Behavior on Timeout**:
- Error thrown and caught in try/catch
- Execution marked `status: 'failed'`
- Partial results saved to execution document
- Error logged to `agent_logs`

---

### Step 3: Detect FAQs & Auto-Respond

**Function**: `detectAndRespondFAQs(messages, ctx)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:405-556`

**Purpose**: Detect FAQ questions and send auto-responses (up to `maxAutoResponses` limit).

**Execution Flow**:

1. **Batch Configuration**:
   ```typescript
   const batchSize = 20; // Smaller than categorization due to cost
   ```

2. **Batch Processing with Early Termination**:
   ```typescript
   for (let i = 0; i < messages.length; i += batchSize) {
     if (autoResponsesSent >= ctx.config.maxAutoResponses) {
       console.log(`Reached max auto-responses limit, stopping`);
       break; // Stop early
     }
     const batch = messages.slice(i, i + batchSize);
     await Promise.all(batch.map(async (msgDoc) => { ... }));
   }
   ```

3. **For Each Message**:

   a. **Call FAQ Detection Edge Function**:
   ```typescript
   const response = await fetch(`${edgeFunctionUrl}/api/detect-faq`, {
     method: 'POST',
     body: JSON.stringify({
       messageText: msgData.text,
       userId: ctx.userId,
     }),
   });
   const result = await response.json();
   // result: { isFAQ: boolean, confidence: number, templateId: string, suggestedResponse: string }
   ```

   b. **If FAQ Detected** (`isFAQ: true` AND `confidence >= 0.8`):

   - **IV2: Manual Override Check**:
     ```typescript
     const hasManualOverride = await hasManualMessagesAfter(
       ctx.userId,
       msgData.conversationId,
       ctx.startTime
     );
     if (hasManualOverride) {
       // User manually responded during workflow, skip auto-response
       await msgDoc.ref.update({
         'metadata.manualOverride': true,
         'metadata.skippedReason': 'Creator sent manual message',
       });
       return;
     }
     ```

   - **If Approval Not Required** (`requireApproval: false`):
     ```typescript
     await db
       .collection('conversations')
       .doc(msgData.conversationId)
       .collection('messages')
       .add({
         conversationId: msgData.conversationId,
         senderId: ctx.userId,
         text: result.suggestedResponse,
         status: 'delivered',
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
         metadata: {
           isAutoResponse: true,
           originalMessageId: msgDoc.id,
           faqTemplateId: result.templateId,
         },
       });
     autoResponsesSent++;
     ```

   - **If Approval Required** (`requireApproval: true`):
     ```typescript
     await msgDoc.ref.update({
       'metadata.isFAQ': true,
       'metadata.faqTemplateId': result.templateId,
       'metadata.suggestedResponse': result.suggestedResponse,
       'metadata.pendingReview': true,
     });
     ```

4. **Update Context**:
   ```typescript
   ctx.results.faqsDetected = faqsDetected;
   ctx.results.autoResponsesSent = autoResponsesSent;
   ctx.costs.faqDetection = faqCost;
   ```

**Performance Optimization**:
- **Batch size**: 20 messages
- **Parallelization**: All messages in batch processed simultaneously
- **Early termination**: Stops when `maxAutoResponses` reached

**Example**:
- 70 messages to check
- Batch 1: 20 messages → 8 FAQs detected, 8 auto-responses sent
- Batch 2: 20 messages → 7 FAQs detected, 7 auto-responses sent
- Batch 3: 20 messages → 6 FAQs detected, **5 auto-responses sent** (hit limit of 20)
- Batch 4: 10 messages → **skipped** (limit reached)
- **Total**: 21 FAQs detected, 20 auto-responses sent
- Cost: 60 × $0.03 = $1.80

---

### Timeout Check #2

**Location**: `functions/src/ai/daily-agent-workflow.ts:1192-1195`

```typescript
if (isWorkflowTimedOut(ctx)) {
  throw new Error('Workflow timeout: exceeded 5 minute limit after FAQ detection');
}
```

---

### Step 4: Draft Voice-Matched Responses

**Function**: `draftVoiceMatchedResponses(messages, ctx)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:571-631`

**Purpose**: Mark non-FAQ messages as needing voice-matched response generation.

**Execution Flow**:

1. **Filter Out FAQ Messages**:
   ```typescript
   const nonFaqMessages = messages.filter((msgDoc) => {
     const msgData = msgDoc.data();
     return !msgData.metadata?.isFAQ && !msgData.metadata?.autoResponseSent;
   });
   ```

2. **Mark Each Message for Voice Response**:
   ```typescript
   for (const msgDoc of nonFaqMessages) {
     await msgDoc.ref.update({
       'metadata.needsVoiceResponse': true,
       'metadata.pendingReview': true,
     });
     responsesDrafted++;
   }
   ```

3. **Estimate Cost** (actual generation happens separately):
   ```typescript
   draftCost += 1.5; // $1.50 per GPT-4 Turbo response (estimated)
   ```

4. **Update Context**:
   ```typescript
   ctx.results.responsesDrafted = responsesDrafted;
   ctx.results.messagesNeedingReview = responsesDrafted;
   ctx.costs.responseGeneration = draftCost;
   ```

**Note**:
- This step **does not** generate actual responses
- Actual voice-matched response generation happens via separate Edge Function or manual trigger
- Cost is estimated, not incurred during workflow

**Example**:
- 70 total messages
- 21 were FAQs (handled in Step 3)
- **49 non-FAQ messages** marked for voice response
- Estimated cost: 49 × $1.50 = $73.50 (not actually charged yet)

---

### Timeout Check #3

**Location**: `functions/src/ai/daily-agent-workflow.ts:1200-1203`

```typescript
if (isWorkflowTimedOut(ctx)) {
  throw new Error('Workflow timeout: exceeded 5 minute limit after response drafting');
}
```

---

### Step 5: Generate Daily Digest

**Function**: `generateDailyDigest(ctx)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:877-932`

**Purpose**: Create daily digest document and send push notification.

**Execution Flow**:

1. **Create Summary Text**:
   ```typescript
   const summaryText = `${ctx.results.autoResponsesSent} handled, ${ctx.results.messagesNeedingReview} need review`;
   ```

2. **Create Digest Document**:
   ```typescript
   const digestRef = await db
     .collection('users')
     .doc(ctx.userId)
     .collection('daily_digests')
     .add({
       userId: ctx.userId,
       executionId: ctx.executionId,
       date: admin.firestore.FieldValue.serverTimestamp(),
       summary: {
         totalHandled: ctx.results.autoResponsesSent,
         totalNeedingReview: ctx.results.messagesNeedingReview,
         summaryText: summaryText,
       },
       handledMessages: [], // Populated separately
       pendingMessages: [], // Populated separately
       createdAt: admin.firestore.FieldValue.serverTimestamp(),
     });
   ```

3. **Send Push Notification** (Task 13):
   ```typescript
   await sendDailyDigestPushNotification(ctx.userId, {
     totalHandled: ctx.results.autoResponsesSent,
     needReview: ctx.results.messagesNeedingReview,
     errors: 0,
     digestId: digestRef.id,
     date: dateStr,
   });
   ```

**Push Notification Logic**:

a. **Fetch User's FCM Tokens**:
```typescript
const userDoc = await db.collection('users').doc(userId).get();
const fcmTokens = userData?.fcmTokens || [];
```

b. **Check Notification Preferences**:
- If `settings.notifications.enabled === false` → skip notification
- If in quiet hours → skip notification

c. **Build Notification Body** (dynamic based on results):
```typescript
if (errors > 0) {
  body = `⚠️ ${errors} error(s) occurred. Please review.`;
} else if (needReview > 0) {
  body = `${totalHandled} handled, ${needReview} need your review`;
} else if (totalHandled > 0) {
  body = `${totalHandled} conversation(s) handled automatically`;
} else {
  body = 'Your daily digest is ready';
}
```

d. **Send via FCM**:
```typescript
const payload: admin.messaging.MulticastMessage = {
  tokens: nativeTokens,
  notification: {
    title: '📊 Daily Digest Ready',
    body,
  },
  data: {
    type: 'daily_digest',
    digestId: digestSummary.digestId,
    screen: 'daily-digest',
    // ... deep linking data
  },
};
await messaging.sendEachForMulticast(payload);
```

**Performance Tracking**:
- Duration measured and logged
- Warning if > 15 seconds

**Example**:
- Summary: "20 handled, 49 need review"
- Digest ID: `digest_abc123`
- Notification sent to 2 devices (iPhone, iPad)
- Deep link: `yipyap://daily-digest?id=digest_abc123`

---

## Error Handling & Rollback

### Try/Catch Block

**Location**: `functions/src/ai/daily-agent-workflow.ts:1153-1253`

```typescript
try {
  // ... all workflow steps
} catch (error) {
  console.error('Workflow execution failed:', error);

  // Mark execution as failed
  await db
    .collection('users')
    .doc(userId)
    .collection('daily_executions')
    .doc(executionId)
    .update({
      status: 'failed',
      results: ctx.results,
      'metrics.endTime': admin.firestore.FieldValue.serverTimestamp(),
      'metrics.duration': (endTime.seconds - startTime.seconds) * 1000,
      'metrics.costIncurred': Math.round(ctx.costs.total * 100),
    });

  throw error;
}
```

### Error Scenarios

| Error Type | Behavior | Partial Results Saved? | User Notified? |
|------------|----------|------------------------|----------------|
| Firestore timeout | Workflow aborted | ✅ Yes | ❌ No |
| Edge Function 500 error | Step fails, workflow aborted | ✅ Yes | ❌ No |
| Workflow timeout (> 5 min) | Workflow aborted with error | ✅ Yes | ❌ No |
| Invalid configuration | Workflow fails immediately | ✅ Yes | ❌ No |
| Network error | Retry (within step), then fail | ✅ Yes | ❌ No |

### Partial Success Handling

**Scenario**: Workflow completes 3 of 5 steps before timing out

```typescript
// Execution document after timeout:
{
  status: 'failed',
  results: {
    messagesFetched: 70,
    messagesCategorized: 70,
    faqsDetected: 21,
    autoResponsesSent: 0,     // Step 4 didn't complete
    responsesDrafted: 0,      // Step 4 didn't complete
    messagesNeedingReview: 0,
  },
  metrics: {
    duration: 310000, // 5 min 10 sec (exceeded limit)
    costIncurred: 530, // $5.30 (only Steps 1-3 charged)
  },
}
```

**User Impact**:
- Categorization completed (saved to message metadata)
- FAQ detection completed (21 FAQs processed)
- **But**: No digest generated, no notification sent
- Messages remain in partially processed state
- Can be reprocessed in next scheduled run

---

## Performance Tracking

### Per-Step Tracking

**Function**: `trackStepPerformance(ctx, stepName, duration)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:152-195`

**Tracked Metrics**:
```typescript
ctx.performance = {
  fetchDuration: 12000,           // 12 seconds
  categorizationDuration: 45000,  // 45 seconds
  faqDetectionDuration: 28000,    // 28 seconds
  responseDraftingDuration: 8000, // 8 seconds
  digestGenerationDuration: 7000, // 7 seconds
  totalDuration: 185000,          // 3 min 5 sec
  timeoutWarnings: [
    "Step 'categorize' took 45000ms (warning threshold: 60000ms)"
  ],
};
```

### Warning Thresholds

| Step | Warning Threshold | Typical Duration (100 msgs) |
|------|-------------------|------------------------------|
| fetch | 30 seconds | 10-15 seconds |
| categorize | 60 seconds | 30-45 seconds |
| faq_detect | 45 seconds | 20-30 seconds |
| draft_responses | 90 seconds | 40-60 seconds |
| generate_summary | 15 seconds | 5-10 seconds |

### Saved to Firestore

```typescript
await db
  .collection('users')
  .doc(userId)
  .collection('daily_executions')
  .doc(executionId)
  .update({
    metrics: {
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      costIncurred: Math.round(ctx.costs.total * 100),
      performance: ctx.performance, // Per-step breakdown
    },
  });
```

---

## Integration Verification

### IV1: Non-Interference with Real-Time Messaging

**Implementation**: `fetchUnprocessedMessages()` - Line 226-232

**Logic**:
```typescript
if (
  convData.lastMessageTimestamp &&
  convData.lastMessageTimestamp.seconds > oneHourAgo.seconds
) {
  continue; // Skip this conversation
}
```

**Test Case**:
- Conversation with message from 30 minutes ago → **Skipped** ✅
- Conversation with message from 2 hours ago → **Processed** ✅

---

### IV2: Manual Override Logic

**Implementation**: `detectAndRespondFAQs()` - Line 515-537

**Logic**:
```typescript
const hasManualOverride = await hasManualMessagesAfter(
  ctx.userId,
  msgData.conversationId,
  ctx.startTime
);

if (hasManualOverride) {
  await msgDoc.ref.update({
    'metadata.manualOverride': true,
    'metadata.skippedReason': 'Creator sent manual message',
  });
  return; // Skip auto-response
}
```

**Test Case**:
- User manually responds during workflow → Auto-response **skipped** ✅
- No manual response → Auto-response **sent** ✅

---

### IV3: Online/Offline Status Awareness

**Implementation**: `orchestrateWorkflow()` - Line 1057-1110

**Logic**:
```typescript
const isActive = await isUserOnlineOrActive(userId, activeThresholdMinutes);

if (isActive) {
  // Create "skipped" execution, return early
  return { success: true, results: { ... all zeros ... } };
}
```

**Test Cases**:
- User status = 'online' → Workflow **skipped** ✅
- User last seen 10 minutes ago (threshold: 30) → Workflow **skipped** ✅
- User last seen 2 hours ago → Workflow **executed** ✅

---

## Execution Logging

### Agent Logs

**Function**: `logWorkflowStep(ctx, step, status, message)`
**Location**: `functions/src/ai/daily-agent-workflow.ts:942-964`

**Log Entry Structure**:
```typescript
{
  executionId: "exec_1234567890_user123",
  userId: "user123",
  timestamp: Timestamp,
  level: "info" | "error",
  message: "Fetched 70 messages in 12000ms",
  metadata: {
    step: "fetch",
    status: "completed",
  },
}
```

**Logged Events**:
- Step start: `"running"`
- Step completion: `"completed"` with duration and results
- Step failure: `"failed"` with error message

**Query Agent Logs**:
```typescript
const logs = await db
  .collection('users')
  .doc(userId)
  .collection('agent_logs')
  .where('executionId', '==', executionId)
  .orderBy('timestamp', 'asc')
  .get();
```

---

## Workflow Completion

### Success Path

**Location**: `functions/src/ai/daily-agent-workflow.ts:1208-1236`

```typescript
const endTime = admin.firestore.Timestamp.now();
const duration = (endTime.seconds - startTime.seconds) * 1000;

await db
  .collection('users')
  .doc(userId)
  .collection('daily_executions')
  .doc(executionId)
  .update({
    status: 'completed',
    results: ctx.results,
    digestSummary: `${ctx.results.autoResponsesSent} handled, ${ctx.results.messagesNeedingReview} need review`,
    metrics: {
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      costIncurred: Math.round(ctx.costs.total * 100), // Convert to cents
      performance: ctx.performance || {},
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

return {
  success: true,
  executionId,
  results: ctx.results,
  metrics: {
    duration,
    costIncurred: ctx.costs.total,
  },
};
```

### Example Completed Execution

```json
{
  "id": "exec_1234567890_user123",
  "userId": "user123",
  "executionDate": "2025-10-24T09:00:00Z",
  "status": "completed",
  "results": {
    "messagesFetched": 70,
    "messagesCategorized": 70,
    "faqsDetected": 21,
    "autoResponsesSent": 20,
    "responsesDrafted": 49,
    "messagesNeedingReview": 49
  },
  "digestSummary": "20 handled, 49 need review",
  "metrics": {
    "startTime": "2025-10-24T09:00:00Z",
    "endTime": "2025-10-24T09:03:05Z",
    "duration": 185000,
    "costIncurred": 810,
    "performance": {
      "fetchDuration": 12000,
      "categorizationDuration": 45000,
      "faqDetectionDuration": 28000,
      "responseDraftingDuration": 8000,
      "digestGenerationDuration": 7000,
      "totalDuration": 185000,
      "timeoutWarnings": []
    }
  },
  "createdAt": "2025-10-24T09:00:00Z",
  "updatedAt": "2025-10-24T09:03:05Z"
}
```

---

**Last Updated**: 2025-10-24
**Story**: 5.8 - Multi-Step Daily Agent
**Task**: 16.3 - Document Workflow Orchestration Steps

**See Also**:
- [Daily Agent Configuration](./daily-agent-configuration.md)
- [Daily Agent Performance Metrics](./daily-agent-performance-metrics.md)
- [Daily Agent Workflow Code](../../functions/src/ai/daily-agent-workflow.ts)
