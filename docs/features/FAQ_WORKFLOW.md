# FAQ Template Creation and Auto-Response Workflow

This document explains the end-to-end workflow for creating FAQ templates, detecting FAQ questions, and automatically responding to fans in YipYap (Story 5.4).

## Table of Contents

1. [Overview](#overview)
2. [FAQ Template Creation Workflow](#faq-template-creation-workflow)
3. [Embedding Generation Process](#embedding-generation-process)
4. [FAQ Detection Workflow](#faq-detection-workflow)
5. [Auto-Response Workflow](#auto-response-workflow)
6. [Manual Approval Workflow](#manual-approval-workflow)
7. [Analytics and Usage Tracking](#analytics-and-usage-tracking)
8. [Conversation Settings](#conversation-settings)
9. [Error Handling and Fallbacks](#error-handling-and-fallbacks)

---

## Overview

### What is FAQ Auto-Response?

FAQ Auto-Response is an AI-powered feature that automatically detects when fans ask frequently asked questions and sends pre-configured responses on behalf of the creator.

**Key Benefits:**
- **Time Savings:** Creators save 2 minutes per auto-response
- **Instant Responses:** Fans receive immediate answers
- **Consistent Messaging:** Standardized answers to common questions
- **Smart Detection:** Uses semantic search (not just keyword matching)
- **Manual Control:** Creators can override or disable auto-responses

### How It Works (High-Level)

```
Fan sends message → FAQ Detection (Edge Function) → Auto-Response (Cloud Function)
                                    ↓
                          Pinecone Vector Search
                                    ↓
                     Match > 85% confidence → Auto-send
                     Match 70-84% confidence → Suggest to creator
                     Match < 70% confidence → No action
```

---

## FAQ Template Creation Workflow

### Step 1: Creator Creates FAQ Template

**User Flow:**
1. Creator navigates to FAQ management screen in mobile app
2. Taps "Create New FAQ"
3. Fills in FAQ form:
   - **Question:** "What are your rates for custom videos?"
   - **Answer:** "My custom video rates start at $50 for a 30-second personalized message."
   - **Keywords:** ['rates', 'pricing', 'cost', 'custom video'] (optional)
   - **Category:** 'pricing'
   - **Active:** true (default)
4. Taps "Save FAQ"

**Code Flow:**

```typescript
import { createFAQTemplate } from '@/services/faqService';

const result = await createFAQTemplate({
  question: 'What are your rates for custom videos?',
  answer: 'My custom video rates start at $50 for a 30-second personalized message.',
  keywords: ['rates', 'pricing', 'cost', 'custom video'],
  category: 'pricing',
});

if (result.embeddingTriggered) {
  console.log('FAQ created - embedding generation in progress');
} else {
  console.warn('FAQ created but embedding failed:', result.embeddingError);
}
```

**What Happens:**
1. FAQ template document created in Firestore: `/faq_templates/{faqId}`
2. Initial fields set:
   - `creatorId`: Current user
   - `useCount`: 0
   - `isActive`: true
   - `createdAt`: Server timestamp
   - `updatedAt`: Server timestamp
3. Firebase Cloud Function `generateFAQEmbedding` is triggered (non-blocking)

**Validation Rules:**
- Question: 1-500 characters (required)
- Answer: 1-2000 characters (required)
- Category: Required
- Keywords: Array (can be empty)

---

## Embedding Generation Process

### Step 2: Generate Vector Embedding (Async)

**Process Flow:**

```
FAQ Created → Firebase Function → OpenAI API → Pinecone Storage → Firestore Update
```

**Detailed Steps:**

1. **Cloud Function Invocation**
   - Function: `generateFAQEmbedding` (Firebase Callable Function)
   - Triggered by: `createFAQTemplate()` service call
   - Input: `{ faqId, question }`

2. **Authentication & Validation**
   - Verify user is authenticated
   - Verify user owns the FAQ template
   - Validate question text is not empty

3. **Embedding Generation (OpenAI)**
   - Model: `text-embedding-3-small`
   - Input: FAQ question text
   - Output: 1536-dimensional vector
   - Target latency: <200ms

4. **Pinecone Storage**
   - Index: `yipyap-faq-embeddings`
   - Vector ID: FAQ template ID
   - Metadata stored:
     ```json
     {
       "creatorId": "user123",
       "isActive": true,
       "category": "pricing",
       "question": "What are your rates?"
     }
     ```
   - Target latency: <50ms

5. **Firestore Update**
   - Update FAQ template:
     ```typescript
     {
       embeddingStatus: 'completed',
       updatedAt: serverTimestamp()
     }
     ```

**Retry Logic:**

If embedding generation fails:
- **Retry:** Up to 3 attempts with exponential backoff (1s, 2s, 4s)
- **On failure:** Mark FAQ as `embeddingStatus: 'pending_embedding'`
- **User impact:** FAQ template saved but won't match incoming messages until embedding succeeds
- **Resolution:** Background job retries failed embeddings periodically

**Code Example:**

```typescript
// Automatic - triggered by createFAQTemplate()
// Manual retry:
const functions = getFunctions();
const generateEmbedding = httpsCallable(functions, 'generateFAQEmbedding');

const result = await generateEmbedding({
  faqId: 'faq123',
  question: 'What are your rates?'
});

if (result.data.success) {
  console.log('Embedding dimension:', result.data.embeddingDimension); // 1536
}
```

---

## FAQ Detection Workflow

### Step 3: Fan Sends Message

**User Flow:**
1. Fan opens conversation with creator
2. Fan types: "How much do you charge for custom videos?"
3. Fan sends message

**What Happens Behind the Scenes:**

```
Message Created → Edge Function (FAQ Detection) → Metadata Added → Message Saved
```

**Detailed Process:**

1. **Message Service Call**
   ```typescript
   await sendMessage({
     conversationId: 'conv123',
     senderId: 'fan456',
     text: 'How much do you charge for custom videos?',
   });
   ```

2. **Edge Function Request (Parallel with message save)**
   - Endpoint: `POST https://api.yipyap.wtf/api/detect-faq`
   - Request:
     ```json
     {
       "messageId": "msg789",
       "messageText": "How much do you charge for custom videos?",
       "creatorId": "creator123"
     }
     ```

3. **FAQ Detection Algorithm**
   - **Step A:** Generate embedding for fan's message (OpenAI)
   - **Step B:** Query Pinecone for similar FAQ templates
     - Filter: `creatorId = 'creator123'` AND `isActive = true`
     - TopK: 3 results
     - MinScore: 0.70 (70% confidence)
   - **Step C:** Return best match with confidence score

4. **Response Examples**

   **High Confidence (≥85%):**
   ```json
   {
     "success": true,
     "isFAQ": true,
     "faqTemplateId": "faq123",
     "matchConfidence": 0.92,
     "latency": 187,
     "performance": {
       "totalMs": 187,
       "embeddingMs": 145,
       "pineconeMs": 32,
       "overheadMs": 10
     },
     "model": "text-embedding-3-small"
   }
   ```

   **Medium Confidence (70-84%):**
   ```json
   {
     "success": true,
     "isFAQ": false,
     "matchConfidence": 0.78,
     "suggestedFAQ": {
       "templateId": "faq123",
       "question": "What are your rates?",
       "answer": "...",
       "confidence": 0.78
     },
     "latency": 182
   }
   ```

   **Low Confidence (<70%):**
   ```json
   {
     "success": true,
     "isFAQ": false,
     "matchConfidence": 0.45,
     "latency": 178
   }
   ```

5. **Message Metadata Update**

   If FAQ detected (≥85% confidence):
   ```typescript
   await updateDoc(messageRef, {
     'metadata.isFAQ': true,
     'metadata.faqTemplateId': 'faq123',
     'metadata.faqMatchConfidence': 0.92,
     'metadata.aiProcessed': true,
   });
   ```

**Performance Targets:**
- Embedding generation: <200ms
- Pinecone query: <50ms
- Total latency: <500ms (95th percentile)

---

## Auto-Response Workflow

### Step 4: Automatic Response Sent (High Confidence Only)

**Trigger:** Firestore onCreate event on message with `metadata.isFAQ = true`

**Auto-Response Flow:**

```
Message Created → Cloud Function Trigger → Delay 500ms → Check Manual Override → Send Auto-Response
```

**Detailed Process:**

1. **Firestore Trigger Activated**
   - Function: `onFAQDetected`
   - Trigger path: `conversations/{conversationId}/messages/{messageId}`
   - Event: `onCreate`

2. **Validation Checks**
   ```typescript
   // Check 1: Is this an FAQ?
   if (!messageData.metadata?.isFAQ) return;

   // Check 2: High confidence?
   if (messageData.metadata.faqMatchConfidence < 0.85) return;

   // Check 3: Auto-response enabled for conversation?
   if (!conversationData.autoResponseEnabled) return;

   // Check 4: FAQ template exists and is active?
   const faqTemplate = await getFAQTemplate(faqTemplateId);
   if (!faqTemplate.isActive) return;
   ```

3. **Manual Override Window (500ms delay)**
   ```typescript
   // Wait 500ms to allow creator to send manual response
   await sleep(500);

   // Check if creator sent manual message in last 1 second
   const hasManualMessage = await hasRecentManualMessage(
     conversationId,
     creatorId,
     messageTimestamp
   );

   if (hasManualMessage) {
     console.log('Creator sent manual message - skipping auto-response');
     return;
   }
   ```

4. **Create Auto-Response Message**
   ```typescript
   const autoResponseMessage = {
     conversationId,
     senderId: creatorId, // Auto-response sent as creator
     text: faqTemplate.answer,
     status: 'delivered',
     readBy: [creatorId],
     timestamp: serverTimestamp(),
     metadata: {
       autoResponseSent: true,
       faqTemplateId: faqTemplate.id,
       aiProcessed: true,
       aiVersion: 'faq-auto-response-v1',
     },
   };

   const autoResponseRef = await addMessage(autoResponseMessage);
   ```

5. **Link Auto-Response to Original Message**
   ```typescript
   // Update original message to track auto-response
   await updateDoc(originalMessageRef, {
     'metadata.autoResponseId': autoResponseRef.id,
   });
   ```

6. **Update FAQ Template Statistics**
   ```typescript
   await updateDoc(faqTemplateRef, {
     useCount: increment(1),
     lastUsedAt: serverTimestamp(),
   });
   ```

**What Fan Sees:**

```
[Fan] How much do you charge for custom videos?
[Creator - Auto] My custom video rates start at $50 for a 30-second message. ⚡
```

**Auto-Response Indicators:**
- Lightning bolt emoji (⚡) or badge in UI
- "Auto-response" label (optional)
- Different message styling (optional)

---

## Manual Approval Workflow

### Step 5: Creator Approves Suggested FAQ (Medium Confidence)

**When:** FAQ matched with 70-84% confidence

**User Flow:**

1. **Fan sends message:**
   ```
   [Fan] What's your availability next week?
   ```

2. **Creator sees suggestion in UI:**
   ```
   💡 Suggested FAQ Response (78% match)

   Question: "What is your availability?"
   Answer: "I'm currently booking 2-3 weeks out. Please check my calendar for available slots."

   [Send This Response]  [Ignore]
   ```

3. **Creator taps "Send This Response"**

**Code Flow:**

```typescript
import { sendSuggestedFAQ } from '@/services/faqService';

const responseMessage = await sendSuggestedFAQ(
  originalMessage,
  suggestedFAQ.templateId,
  suggestedFAQ.answer
);

console.log('Manual FAQ response sent:', responseMessage.id);
```

**What Happens:**

1. FAQ answer sent as regular message from creator
2. Original message metadata updated:
   ```typescript
   {
     metadata: {
       manualFAQSend: true, // Not autoResponseSent
       manualFAQResponseId: responseMessage.id,
       approvedFAQTemplateId: faqTemplateId,
     }
   }
   ```
3. FAQ template statistics updated (same as auto-response):
   ```typescript
   {
     useCount: increment(1),
     lastUsedAt: serverTimestamp(),
   }
   ```

**Difference from Auto-Response:**
- Manual send: `metadata.manualFAQSend = true`
- Auto-response: `metadata.autoResponseSent = true`
- Both update FAQ statistics identically

---

## Analytics and Usage Tracking

### FAQ Analytics Dashboard

**Metrics Tracked:**

```typescript
const analytics = await getFAQAnalytics('creator123');

console.log(analytics);
// {
//   totalTemplates: 15,
//   activeTemplates: 12,
//   totalAutoResponses: 127,
//   timeSavedMinutes: 254,  // 127 responses × 2 min each
//   topFAQs: [
//     { id: 'faq1', question: 'What are your rates?', useCount: 42, category: 'pricing' },
//     { id: 'faq2', question: 'What is your availability?', useCount: 31, category: 'scheduling' },
//     // ... top 10
//   ],
//   usageByCategory: {
//     pricing: 65,
//     scheduling: 31,
//     shipping: 18,
//     general: 13,
//   }
// }
```

**UI Display:**

```
📊 FAQ Performance (Last 30 Days)

⏱️ Time Saved: 4 hours 14 minutes
📨 Auto-Responses Sent: 127
📝 Active FAQs: 12 / 15 total

Top FAQs:
1. What are your rates? (42 uses)
2. What is your availability? (31 uses)
3. How do I request a refund? (18 uses)

Usage by Category:
Pricing:    ████████████████░░░░ 65 (51%)
Scheduling: ██████████░░░░░░░░░░ 31 (24%)
Shipping:   ██████░░░░░░░░░░░░░░ 18 (14%)
General:    ████░░░░░░░░░░░░░░░░ 13 (10%)
```

**Per-FAQ Statistics:**

Each FAQ template shows:
- **Total Uses:** Number of times auto-response sent
- **Last Used:** Timestamp of most recent use
- **Category:** FAQ category
- **Status:** Active / Inactive

---

## Conversation Settings

### Per-Conversation Auto-Response Toggle

**User Flow:**

1. Creator opens conversation with fan
2. Taps conversation settings (⚙️)
3. Toggles "Auto-Response" on/off
4. Change saved to Firestore

**Data Model:**

```typescript
// Conversation document: /conversations/{conversationId}
{
  autoResponseEnabled: true,  // Simple boolean (default: true)

  // OR nested settings:
  autoResponseSettings: {
    enabled: true,
    maxPerDay: 10,           // Optional: limit auto-responses per day
    requireApproval: false,  // Optional: require manual approval even for high confidence
  }
}
```

**Checking Status in Auto-Response Function:**

```typescript
function isAutoResponseEnabled(conversationData: ConversationData): boolean {
  // Check simple boolean (backward compatible)
  if (conversationData.autoResponseEnabled === false) {
    return false;
  }

  // Check nested settings if present
  if (conversationData.autoResponseSettings?.enabled === false) {
    return false;
  }

  return true; // Default: enabled
}
```

**Use Cases:**

- **VIP Conversations:** Disable auto-response for high-value fans
- **Personal Touch:** Disable for fans who prefer manual responses
- **Testing:** Disable temporarily while testing new FAQs
- **Rate Limiting:** Prevent too many auto-responses in one conversation

---

## Error Handling and Fallbacks

### What Happens When Things Go Wrong

#### 1. Edge Function Unavailable

**Scenario:** Vercel Edge Function down or unreachable

**Behavior:**
- Message is still delivered normally ✅
- No FAQ detection performed
- `metadata.aiProcessed = false`
- Error logged for monitoring

**Impact:** No auto-response sent, creator responds manually (graceful degradation)

#### 2. Pinecone Unavailable

**Scenario:** Pinecone service down or API rate limited

**Fallback:** Keyword matching (simple text search)
```typescript
// Fallback to basic keyword matching
const keywords = faqTemplate.keywords;
const messageText = message.text.toLowerCase();
const hasKeywordMatch = keywords.some(kw => messageText.includes(kw.toLowerCase()));

if (hasKeywordMatch) {
  return {
    isFAQ: true,
    faqTemplateId: faqTemplate.id,
    matchConfidence: 0.75, // Lower confidence for keyword matching
    matchMethod: 'keyword-fallback',
  };
}
```

**Impact:** Reduced accuracy, but FAQ detection still works

#### 3. OpenAI API Failure (Embedding Generation)

**Scenario:** OpenAI API rate limited or down

**Behavior:**
- FAQ template saved to Firestore ✅
- Embedding generation fails
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- After retries: Mark as `embeddingStatus: 'pending_embedding'`

**Resolution:**
- Background job retries failed embeddings every 10 minutes
- Creator can manually retry via UI
- FAQ won't match messages until embedding succeeds

#### 4. Auto-Response Failure

**Scenario:** Auto-response function crashes or times out

**Behavior:**
- Original message still delivered ✅
- Error logged but not thrown (non-critical)
- FAQ statistics not updated
- Creator can respond manually

**Impact:** Fan doesn't receive auto-response (graceful degradation)

#### 5. Rate Limiting (Edge Function)

**Scenario:** Too many FAQ detection requests from one creator

**Limit:** 100 requests per minute per creator

**Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded - too many FAQ detection requests",
  "retryAfter": 60
}
```

**Behavior:**
- Message still delivered ✅
- No FAQ detection until rate limit resets
- Creator responds manually

---

## Best Practices

### For Creators

**Writing Effective FAQ Questions:**
- ✅ Use natural language: "What are your rates?"
- ✅ Include variations: "How much do you charge?" / "What's your pricing?"
- ❌ Avoid overly specific: "What are your rates for 30-second custom video on Tuesday?"

**Writing Clear FAQ Answers:**
- ✅ Be concise and clear
- ✅ Include specific details (prices, timeframes)
- ✅ End with a call-to-action if needed
- ❌ Avoid vague answers: "It depends..."

**Categorizing FAQs:**
- Use consistent categories: pricing, availability, shipping, refunds, general
- Helps with organization and analytics
- Enables category-based filtering in UI

**Managing Active/Inactive FAQs:**
- Deactivate outdated FAQs (old pricing, past events)
- Keep active FAQs up-to-date
- Review analytics to identify unused FAQs

### For Developers

**Performance Optimization:**
- Cache frequent FAQ queries (consider Redis)
- Monitor Edge Function latency (target: <500ms P95)
- Set up alerts for API failures (OpenAI, Pinecone)

**Testing:**
- Test FAQ detection with various phrasings
- Test manual override (creator sends message within 1 second)
- Test conversation-level auto-response toggle
- Test error scenarios (API failures, network issues)

**Monitoring:**
- Track auto-response success rate (target: >99%)
- Monitor embedding generation failures
- Track FAQ detection latency breakdown
- Alert on Pinecone quota usage (free tier: 100K vectors)

---

## Related Documentation

- **Setup Guide:** [docs/setup/PINECONE_SETUP.md](../setup/PINECONE_SETUP.md)
- **Performance Testing:** [docs/stories/TASK-17-COMPLETION.md](../stories/TASK-17-COMPLETION.md)
- **Error Handling:** [docs/stories/TASK-18-COMPLETION.md](../stories/TASK-18-COMPLETION.md)
- **Story 5.4:** [docs/stories/5.4.story.md](../stories/5.4.story.md)
- **API Reference:** [services/faqService.ts](../../services/faqService.ts)
