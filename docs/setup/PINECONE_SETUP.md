# Pinecone Setup Guide for FAQ Detection

This guide explains how to set up and configure Pinecone for the FAQ Detection & Auto-Response feature (Story 5.4).

## Overview

YipYap uses Pinecone as a vector database for semantic FAQ matching. When users create FAQ templates, the system generates vector embeddings using OpenAI's text-embedding-3-small model and stores them in Pinecone for fast similarity search.

**Architecture:**
- **OpenAI**: Generates 1536-dimensional embeddings from FAQ question text
- **Pinecone**: Stores and queries embeddings with metadata filtering
- **Vercel Edge Functions**: Performs real-time FAQ detection
- **Firebase Functions**: Generates embeddings for new FAQ templates

---

## Prerequisites

- Pinecone account (free tier available at https://www.pinecone.io/)
- OpenAI API key (for embedding generation)
- Node.js 20+ installed
- Firebase project configured

---

## 1. Create Pinecone Account

1. Visit https://www.pinecone.io/ and sign up for an account
2. Choose the **Starter** plan (free tier with 100K vectors, 1 index)
3. Verify your email and log in to the Pinecone console

---

## 2. Create Pinecone Index

### Via Pinecone Console (Recommended)

1. Navigate to **Indexes** in the Pinecone console
2. Click **Create Index**
3. Configure the index:

   ```
   Index Name: yipyap-faq-embeddings
   Dimensions: 1536
   Metric: cosine
   Cloud: AWS (or GCP, depending on your preference)
   Region: us-east-1 (or closest to your Firebase region)
   ```

4. Click **Create Index**

### Via Setup Script (Alternative)

Run the automated setup script:

```bash
npx ts-node scripts/setup-pinecone-index.js
```

This script will:
- Create the Pinecone index with correct dimensions
- Verify the configuration
- Test connectivity

---

## 3. Get API Credentials

1. In the Pinecone console, navigate to **API Keys**
2. Copy your **API Key** (starts with `pcsk_...`)
3. Note your **Environment** (e.g., `us-east-1-aws`)

---

## 4. Configure Environment Variables

### Mobile App (Expo)

Add to `.env.local`:

```env
# Pinecone Configuration (optional for mobile - FAQ detection happens on Edge Function)
EXPO_PUBLIC_PINECONE_INDEX=yipyap-faq-embeddings
```

### Edge Functions (Vercel)

Add to `/api/.env.local` or configure in Vercel dashboard:

```env
# Pinecone Configuration
PINECONE_API_KEY=pcsk_your_api_key_here
PINECONE_INDEX_NAME=yipyap-faq-embeddings
```

**Deploy to Vercel:**

```bash
cd api
vercel env add PINECONE_API_KEY production
# Paste your API key when prompted

vercel env add PINECONE_INDEX_NAME production
# Enter: yipyap-faq-embeddings
```

### Firebase Cloud Functions

Add to `/functions/.env` or use Firebase config:

**Option 1: Environment File (Recommended)**

Create `/functions/.env`:

```env
PINECONE_API_KEY=pcsk_your_api_key_here
PINECONE_INDEX_NAME=yipyap-faq-embeddings
OPENAI_API_KEY=sk-your_openai_key_here
```

**Option 2: Firebase Config**

```bash
firebase functions:config:set \
  pinecone.api_key="pcsk_your_api_key_here" \
  pinecone.index_name="yipyap-faq-embeddings" \
  openai.api_key="sk-your_openai_key_here"

# Deploy the config
firebase deploy --only functions
```

**Verify configuration:**

```bash
firebase functions:config:get
```

---

## 5. Install Dependencies

### Edge Functions (Vercel)

```bash
cd api
npm install @pinecone-database/pinecone @ai-sdk/openai ai
```

### Firebase Cloud Functions

```bash
cd functions
npm install @pinecone-database/pinecone @ai-sdk/openai ai
```

---

## 6. Test Pinecone Connectivity

### Test Edge Function Locally

```bash
# Terminal 1: Start Vercel dev server
cd api
vercel dev

# Terminal 2: Test FAQ detection endpoint
curl -X POST http://localhost:3000/api/detect-faq \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "test-msg-123",
    "messageText": "What are your rates?",
    "creatorId": "test-creator-123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "isFAQ": false,
  "matchConfidence": 0,
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

### Test Firebase Function Locally

```bash
# Start Firebase Emulator Suite
npm run emulator

# In another terminal, test embedding generation
firebase functions:shell

# In the shell:
generateFAQEmbedding({
  faqId: 'test-faq-123',
  question: 'What are your rates?'
})
```

---

## 7. Verify Index Configuration

### Check Index Stats

```bash
npx ts-node scripts/verify-pinecone-index.ts
```

**Expected output:**
```
✓ Connected to Pinecone
✓ Index 'yipyap-faq-embeddings' exists
✓ Dimensions: 1536
✓ Metric: cosine
✓ Total vectors: 0 (no FAQs created yet)
```

### Query Index via Pinecone Console

1. Navigate to **Indexes** → **yipyap-faq-embeddings**
2. Click **Query** tab
3. You should see an empty index (0 vectors) until FAQ templates are created

---

## 8. Create First FAQ Template

Create a test FAQ to verify end-to-end functionality:

```typescript
// In your mobile app or via Firebase console
await createFAQTemplate({
  question: 'What are your rates?',
  answer: 'My rates start at $100 per hour.',
  keywords: ['pricing', 'rates', 'cost'],
  category: 'pricing',
});
```

**What happens:**
1. FAQ template created in Firestore (`/faq_templates/{id}`)
2. Firebase Function `generateFAQEmbedding` is triggered
3. OpenAI generates 1536-dimension embedding
4. Embedding stored in Pinecone with metadata
5. FAQ is now searchable via semantic similarity

**Verify in Pinecone Console:**
- Navigate to **Indexes** → **yipyap-faq-embeddings**
- Total vectors should now be **1**
- Click on vector ID to see metadata (creatorId, isActive, category, question)

---

## 9. Troubleshooting

### Error: "PINECONE_API_KEY not configured"

**Cause:** Environment variable not set or not loaded

**Fix:**
```bash
# Verify .env.local exists
cat api/.env.local | grep PINECONE_API_KEY

# Restart dev server
vercel dev
```

### Error: "Index not found: yipyap-faq-embeddings"

**Cause:** Index doesn't exist or name mismatch

**Fix:**
1. Check index name in Pinecone console
2. Verify `PINECONE_INDEX_NAME` matches exactly
3. Create index if missing (see Step 2)

### Error: "Invalid embedding dimension: expected 1536, got 3072"

**Cause:** Using wrong embedding model

**Fix:**
- Ensure using `text-embedding-3-small` (1536 dimensions)
- NOT `text-embedding-3-large` (3072 dimensions)
- Check `api/detect-faq.ts` and `functions/src/ai/faqEmbeddings.ts`

### Error: "Pinecone quota exceeded"

**Cause:** Free tier limits reached (100K vectors)

**Fix:**
1. Upgrade to paid Pinecone plan
2. Or delete old/unused FAQ embeddings
3. Check quota in Pinecone console → **Usage**

### Slow FAQ Detection (>500ms)

**Possible causes:**
1. **Pinecone region mismatch** - Move index closer to Edge Function region
2. **Cold start** - First request after idle is slower
3. **Network latency** - Check Pinecone status page

**Fix:**
```bash
# Run performance tests to identify bottleneck
npx ts-node scripts/test-faq-performance.ts

# Check latency breakdown:
# - Embedding: should be <200ms
# - Pinecone: should be <50ms
# - Total: should be <500ms (P95)
```

### Embedding Generation Fails

**Error:** "Failed after 3 attempts: OpenAI API rate limit exceeded"

**Fix:**
1. Check OpenAI API quota and billing
2. Reduce FAQ creation rate
3. Wait for rate limit to reset (usually 1 minute)

**Error:** "Failed to store embedding in Pinecone"

**Fix:**
1. Verify Pinecone API key is valid
2. Check Pinecone service status
3. Review Firebase Functions logs: `firebase functions:log`

---

## 10. Production Deployment Checklist

Before deploying FAQ detection to production:

- [ ] Pinecone index created with correct dimensions (1536)
- [ ] API keys configured in Vercel environment variables
- [ ] API keys configured in Firebase Functions environment
- [ ] Edge Function tested locally with `vercel dev`
- [ ] Firebase Function tested with emulator
- [ ] Performance tests passing (<500ms P95 latency)
- [ ] At least one test FAQ template created successfully
- [ ] Pinecone quota checked (ensure headroom for growth)
- [ ] Error logging configured (Vercel, Firebase, Pinecone)
- [ ] Monitoring alerts set up for API failures

**Deploy commands:**

```bash
# Deploy Edge Functions to Vercel
cd api
vercel --prod

# Deploy Firebase Functions
cd functions
firebase deploy --only functions:generateFAQEmbedding

# Verify deployment
curl -X POST https://api.yipyap.wtf/api/detect-faq \
  -H "Content-Type: application/json" \
  -d '{"messageId":"test","messageText":"What are your rates?","creatorId":"test-creator"}'
```

---

## 11. Monitoring and Maintenance

### Monitor Pinecone Usage

1. Navigate to Pinecone console → **Usage**
2. Track:
   - **Total vectors** (FAQ templates)
   - **Query volume** (FAQ detections per day)
   - **Storage usage** (should stay under quota)

**Set alerts:**
- Alert when 80% of vector quota used
- Alert when query latency >100ms

### Monitor Edge Function Performance

Use Vercel Analytics to track:
- **P95 latency** (should be <500ms)
- **Error rate** (should be <1%)
- **Embedding failures** (check OpenAI API status)
- **Pinecone failures** (check Pinecone service status)

**Example query:**
```sql
SELECT
  AVG(performance.totalMs) as mean_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY performance.totalMs) as p95_latency,
  COUNT(*) as total_requests
FROM faq_detection_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
```

### Backup and Recovery

**FAQ Templates:**
- FAQ templates stored in Firestore (`/faq_templates`)
- Enable Firestore backups in Firebase console
- Export FAQs periodically: `firebase firestore:export gs://your-bucket/backups`

**Pinecone Embeddings:**
- Pinecone manages backups automatically
- If index deleted, re-generate embeddings:
  ```bash
  npx ts-node scripts/regenerate-all-embeddings.ts
  ```

---

## 12. Scaling Considerations

### Free Tier Limits

- **Vectors:** 100,000 (approx. 100K FAQ templates)
- **Queries:** Unlimited (but rate limited)
- **Indexes:** 1 index

**When to upgrade:**
- Approaching 80K FAQ templates
- Need multiple indexes (e.g., staging + production)
- Need higher query throughput

### Paid Tier Benefits

- **Multiple indexes** (separate staging/production)
- **More vectors** (millions of FAQs)
- **Higher query throughput** (10K+ queries/sec)
- **Dedicated support**

---

## 13. Additional Resources

- **Pinecone Documentation:** https://docs.pinecone.io/
- **OpenAI Embeddings Guide:** https://platform.openai.com/docs/guides/embeddings
- **YipYap FAQ Feature Docs:** [docs/stories/5.4.story.md](../stories/5.4.story.md)
- **Performance Testing:** [scripts/test-faq-performance.ts](../../scripts/test-faq-performance.ts)

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check Pinecone status: https://status.pinecone.io/
2. Check OpenAI status: https://status.openai.com/
3. Review Firebase Functions logs: `firebase functions:log`
4. Review Vercel logs: https://vercel.com/dashboard → Functions → Logs
5. Open an issue in the YipYap repository
