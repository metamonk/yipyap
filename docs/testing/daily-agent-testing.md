# Daily Agent Auto-Response Test Checklist

## Pre-Test Setup Verification

### 1. Check Daily Agent Config (Phone 1 - Creator)

```
Profile → Daily Agent Settings:
□ Enable Daily Agent: ON
□ Require Approval: OFF ⚠️ MUST BE OFF FOR AUTO-RESPONSES
□ Max Auto-Responses: 20+ (check current count hasn't exceeded)
```

### 2. Check FAQ Templates Exist

Open Firebase Console → Firestore:

```
/users/{your-user-id}/faq_templates
  └─ {templateId}
      ├─ question: "What are your hours?"
      ├─ answer: "We're open 9-5 Monday-Friday"
      ├─ category: "business_hours"
      ├─ embedding: [array of numbers] ⚠️ MUST EXIST
```

**If no FAQ templates exist, auto-responses WILL NOT work!**

### 3. Verify Pinecone Embeddings

Check that FAQ embeddings are indexed in Pinecone:

- Check `/api/detect-faq` Edge Function is deployed
- Verify Pinecone API key is configured

---

## Test Execution Steps

### Step 1: Set Up Conversation (Phone 2 → Phone 1)

1. **Send a message that matches an FAQ**
   - Example: "What are your hours?"
   - Example: "How do I contact you?"

2. **Wait for conversation to become inactive**
   - Option A: Wait 1+ hour after last message
   - Option B: Manually update `lastMessageTimestamp` in Firestore (for faster testing)

### Step 2: Set User Status (Phone 1 - Creator)

**Close the app or set presence to offline:**

```
Firestore: /users/{your-user-id}
  └─ presence:
      ├─ status: "offline"  (or remove this field)
      ├─ lastSeen: [timestamp > 30 min ago]
```

⚠️ **If you're actively using the app, the workflow will skip entirely!**

### Step 3: Trigger Workflow (Phone 1)

**Option A: Manual Trigger (recommended for testing)**

```typescript
// Call via Firebase Functions
const functions = getFunctions();
const trigger = httpsCallable(functions, 'triggerDailyAgentManual');
const result = await trigger({});
console.log(result);
```

**Option B: Wait for Scheduled Time**

- Scheduler runs every hour at :00
- Checks if current time matches your `dailyWorkflowTime` (±5 min window)

### Step 4: Monitor Execution

Check Firestore for execution logs:

```
/users/{your-user-id}/daily_executions/{executionId}
  ├─ status: "completed" | "running" | "failed" | "skipped"
  ├─ results:
  │   ├─ messagesFetched: X
  │   ├─ faqsDetected: Y
  │   ├─ autoResponsesSent: Z  ⚠️ Should be > 0 for success
  └─ digestSummary: "Z handled, Y need review"

/users/{your-user-id}/agent_logs
  └─ Filter by executionId to see step-by-step logs
```

### Step 5: Verify Auto-Response (Phone 2)

Check if message was received:

```
Firestore: /conversations/{convId}/messages
  └─ Look for new message with:
      ├─ senderId: {your-user-id}
      ├─ text: [FAQ answer]
      ├─ metadata.isAutoResponse: true
      ├─ metadata.faqTemplateId: {templateId}
```

---

## Common Issues & Troubleshooting

### ❌ No Auto-Responses Sent (`autoResponsesSent = 0`)

**Possible Causes:**

1. **`requireApproval = true`**
   - Check: Settings shows "Require Approval: ON"
   - Fix: Toggle OFF in Daily Agent Settings

2. **No FAQ templates or embeddings**
   - Check: `/users/{userId}/faq_templates` is empty
   - Fix: Create FAQ templates with embeddings first

3. **Conversation is too recent (< 1 hour)**
   - Check: Conversation `lastMessageTimestamp` in Firestore
   - Fix: Wait 1+ hour OR manually backdate timestamp

4. **FAQ confidence < 80%**
   - Check: `agent_logs` for FAQ detection results
   - Fix: Improve FAQ template matching or add more templates

5. **Manual override detected**
   - Check: You sent a message after workflow started
   - Fix: Don't send messages during workflow execution

### ❌ Workflow Status: "skipped"

**Possible Causes:**

1. **User is online/active**
   - Check: `digestSummary: "Skipped: Creator is currently online/active"`
   - Fix: Close app, set presence to offline, wait 30+ min

2. **No messages to process**
   - Check: `messagesFetched = 0`
   - Fix: Ensure messages meet eligibility criteria

### ❌ Workflow Status: "failed"

**Possible Causes:**

1. **Edge Function errors**
   - Check: `agent_logs` for error messages
   - Fix: Verify `/api/categorize-message` and `/api/detect-faq` are deployed

2. **Firestore permission errors**
   - Check: Firebase Functions logs for "permission-denied"
   - Fix: Review Firestore security rules

---

## Expected Results for Successful Test

✅ **Daily Execution Document:**

```
status: "completed"
results.messagesFetched: 1+
results.faqsDetected: 1+
results.autoResponsesSent: 1+
digestSummary: "1 handled, 0 need review"
```

✅ **Auto-Response Message Created:**

```
/conversations/{convId}/messages/{newMessageId}
  senderId: {your-user-id}
  text: [FAQ answer text]
  metadata.isAutoResponse: true
  metadata.faqTemplateId: {templateId}
  status: "delivered"
```

✅ **Phone 2 Receives:**

- New message notification
- Message appears in conversation
- Message is from you (creator) with FAQ answer

---

## Quick Debug Commands

### Check User Config:

```javascript
// In Firebase Console
db.collection('users').doc('{userId}').collection('ai_workflow_config').doc('{userId}').get();
```

### Check Last Execution:

```javascript
db.collection('users')
  .doc('{userId}')
  .collection('daily_executions')
  .orderBy('executionDate', 'desc')
  .limit(1)
  .get();
```

### Check FAQ Templates:

```javascript
db.collection('users').doc('{userId}').collection('faq_templates').get();
```

### Check Conversation State:

```javascript
db.collection('conversations').doc('{convId}').get();
// Look at: lastMessageTimestamp (must be > 1 hour old)
```

### Check User Presence:

```javascript
db.collection('users').doc('{userId}').get();
// Look at: presence.status, presence.lastSeen
```
