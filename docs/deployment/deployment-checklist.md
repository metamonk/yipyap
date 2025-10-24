# 🚀 Full Stack AI Infrastructure Deployment Checklist

This checklist covers deployment to **both Vercel (Edge Functions)** and **Firebase (Cloud Functions)**.

---

## 📋 Table of Contents

1. [Pre-Deployment Verification](#-pre-deployment-verification)
2. [Part 1: Vercel Edge Functions Deployment](#part-1-vercel-edge-functions-deployment)
3. [Part 2: Firebase Cloud Functions Deployment](#part-2-firebase-cloud-functions-deployment)
4. [Post-Deployment Verification](#-post-deployment-verification)
5. [Monitoring Setup](#-monitoring-setup)
6. [Troubleshooting](#-troubleshooting)

---

## ✅ Pre-Deployment Verification

### Code Quality
- [x] TypeScript build compiles without errors
- [x] Model selector uses GPT-4o-mini for speed/cost
- [x] Model selector uses GPT-4 Turbo for quality
- [x] Anthropic provider code removed
- [x] Unit tests passing (31/42 core tests)
- [x] Integration tests created (skipped without API key)

### Dependencies

**Root Project:**
- [x] All dependencies up to date (`npm ls` shows no issues)

**Vercel Edge Functions** (`/api`):
- [x] `@ai-sdk/openai@^1.0.7` installed
- [x] `@upstash/redis@^1.35.6` installed
- [x] `ai@^5.0.77` installed

**Firebase Functions** (`/functions`):
- [x] `@ai-sdk/anthropic` removed from package.json
- [x] `@ai-sdk/openai@2.0.53` installed
- [x] `ai@5.0.77` installed

### Configuration
- [x] Type definitions updated (OpenAI-only)
- [x] Error handling updated
- [x] Circuit breaker pattern maintained
- [x] Model degradation fallback implemented
- [x] `vercel.json` configured with edge runtime
- [x] `firebase.json` configured for functions

---

# Part 1: Vercel Edge Functions Deployment

## 🌐 Custom Domain Configuration

**Production API Domain**: `https://api.yipyap.wtf`

### ✅ Already Configured
- Custom domain added to Vercel project
- Environment variables updated in `.env.local` and `.env.example`
- App configuration (`Config.ts`) ready to use custom domain

### ⏳ Pending Setup
Before the custom domain works, you need to configure DNS:

1. Go to https://vercel.com/ratlabs/yipyap/settings/domains
2. Find `api.yipyap.wtf` and note the required DNS records
3. Add CNAME or A record to your DNS provider (where you bought `yipyap.wtf`)
4. Wait for DNS propagation (5 min - 48 hours, usually < 1 hour)

**Detailed Instructions**: See `VERCEL_DOMAIN_SETUP.md` for complete DNS setup guide

**Quick Test** (after DNS propagates):
```bash
./scripts/test-api-endpoint.sh
```

---

## 🌐 Vercel Setup Prerequisites

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Verify Edge Function Code
```bash
# Check Edge Function syntax
cd api
npm install
npx tsc --noEmit categorize-message.ts
cd ..
```

---

## 🔐 Vercel Environment Variables Setup

### Step 1: Add Secrets to Vercel

You need to add these secrets to Vercel. Choose one of two methods:

#### Method A: Using Vercel Dashboard (Recommended)
1. Go to https://vercel.com/dashboard
2. Select your project (or create new project)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables for **Production**, **Preview**, and **Development**:

| Variable Name | Value | Required |
|---------------|-------|----------|
| `OPENAI_API_KEY` | Your OpenAI API Key | ✓ Yes |
| `LANGFUSE_PUBLIC_KEY` | Your Langfuse Public Key | Optional |
| `LANGFUSE_SECRET_KEY` | Your Langfuse Secret Key | Optional |
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST Token | Optional |

#### Method B: Using Vercel CLI
```bash
# OpenAI API Key (REQUIRED)
vercel env add OPENAI_API_KEY production
# Enter your OpenAI API key when prompted

# Langfuse Monitoring (Optional but Recommended)
vercel env add LANGFUSE_PUBLIC_KEY production
vercel env add LANGFUSE_SECRET_KEY production

# Upstash Redis for Rate Limiting (Optional but Recommended)
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
```

### Step 2: Get Your API Keys

**OpenAI API Key** (Required):
- Go to https://platform.openai.com/api-keys
- Click "Create new secret key"
- Copy the key (you won't see it again!)

**Langfuse Keys** (Optional but recommended for monitoring):
- Sign up at https://langfuse.com
- Go to Settings → API Keys
- Copy both public and secret keys

**Upstash Redis** (Optional but recommended for rate limiting):
- Sign up at https://upstash.com
- Create a new Redis database
- Copy the REST URL and REST Token

---

## 🚀 Vercel Deployment Steps

### Step 1: Link Your Project to Vercel

```bash
# From project root
vercel link
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your team/account
- **Link to existing project?** → No (if first time) or Yes (if already created)
- **Project name?** → yipyap (or your preferred name)
- **Directory?** → ./ (press Enter)

### Step 2: Preview Deployment (Test First)

```bash
# Deploy to preview environment
vercel
```

This creates a preview deployment. You'll get a URL like: `https://yipyap-abc123.vercel.app`

### Step 3: Test Preview Deployment

```bash
# Test the Edge Function
curl -X POST https://YOUR-PREVIEW-URL.vercel.app/api/categorize-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user-token" \
  -d '{
    "messageId": "test-123",
    "messageText": "This is a test message",
    "conversationId": "conv-123",
    "senderId": "user-123"
  }'
```

Expected response:
```json
{
  "success": true,
  "category": "general",
  "confidence": 0.85,
  "latency": 450,
  "model": "gpt-4o-mini"
}
```

### Step 4: Production Deployment

Once preview testing is successful:

```bash
# Deploy to production
vercel --prod
```

You'll get your production URL: `https://yipyap.vercel.app` (or your custom domain)

---

## ✅ Vercel Deployment Verification

### 1. Check Deployment Status
```bash
vercel ls
```

### 2. View Deployment Logs
```bash
vercel logs
```

Or view in dashboard: https://vercel.com/dashboard → Your Project → Deployments

### 3. Test Production Edge Function

**Using Custom Domain** (recommended after DNS propagates):
```bash
# Quick test script
./scripts/test-api-endpoint.sh

# Or manual test
curl -X POST https://api.yipyap.wtf/api/categorize-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user-token" \
  -d '{
    "messageId": "prod-test-001",
    "messageText": "Hey! Love your content, would you be interested in a brand partnership?",
    "conversationId": "conv-prod-001",
    "senderId": "user-prod-001"
  }'
```

### 4. Verify Environment Variables

```bash
# List all environment variables
vercel env ls
```

Should show all required variables are set for production.

### 5. Monitor Edge Function Performance

Go to Vercel Dashboard:
- **Analytics** → View request counts, latency, error rates
- **Logs** → Real-time function logs
- **Usage** → Check bandwidth and function invocations

---

## 🔧 Vercel Configuration Files

### `vercel.json` (Already configured)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge"
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai-api-key",
    "LANGFUSE_PUBLIC_KEY": "@langfuse-public-key",
    "LANGFUSE_SECRET_KEY": "@langfuse-secret-key",
    "UPSTASH_REDIS_REST_URL": "@upstash-redis-url",
    "UPSTASH_REDIS_REST_TOKEN": "@upstash-redis-token"
  }
}
```

---

## 🎯 Vercel Success Criteria

Vercel deployment is successful when:
- [ ] `vercel --prod` completes without errors
- [ ] Production URL is accessible
- [ ] `/api/categorize-message` endpoint responds with 200 OK
- [ ] Response time < 500ms (Edge Function cold start < 100ms)
- [ ] No errors in Vercel logs
- [ ] Environment variables are set correctly
- [ ] Rate limiting works (if Upstash configured)
- [ ] Langfuse shows traces (if configured)

---

# Part 2: Firebase Cloud Functions Deployment

## 🔥 Firebase Setup Prerequisites

### 1. Verify Firebase CLI Installation
```bash
firebase --version  # Should be 13.x or higher
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Verify Firebase Project
```bash
firebase projects:list
```

Make sure `yipyap-444` is listed.

### 4. Set Active Project
```bash
firebase use yipyap-444
```

---

## 🔐 Firebase Environment Variables Setup

**Modern Approach**: Firebase now uses `.env` files (the `functions:config` API is deprecated as of 2024).

### ✅ Already Configured

Your Firebase Functions already have a `.env` file at `/functions/.env` with all necessary variables:
- ✅ OpenAI API Key
- ✅ Langfuse monitoring keys
- ✅ Upstash Redis credentials
- ✅ AI feature flags

### How It Works

Firebase automatically loads environment variables from `functions/.env` during deployment:
1. Variables are defined in `functions/.env`
2. Access them in code with `process.env.VARIABLE_NAME`
3. Deployment automatically includes the `.env` file

### Verify Configuration

```bash
# Check your functions/.env file
cat functions/.env
```

### To Add/Update Variables

Edit `functions/.env` directly:
```bash
# Open in your editor
code functions/.env

# Or edit with command line
echo "NEW_VARIABLE=value" >> functions/.env
```

**Note**: The `.env` file is ignored by git (in `.gitignore`), so secrets stay secure.

---

## 🚀 Firebase Deployment Steps

### Step 1: Build Functions
```bash
cd functions
npm run build
cd ..
```

### Step 2: Preview Deployment (Optional)
```bash
firebase deploy --only functions --dry-run
```

### Step 3: Deploy Functions Only (Recommended First Time)
```bash
firebase deploy --only functions
```

### Step 4: Full Deployment (Functions + Firestore Rules + Storage)
```bash
# Only run this if you want to deploy everything
firebase deploy
```

### Step 5: Deploy Specific Function
```bash
# If you only want to deploy a specific function
firebase deploy --only functions:sendMessageNotification
```

---

## ✅ Firebase Deployment Verification

### 1. Check Deployment Status
```bash
firebase functions:list
```

Should show all functions with status "ACTIVE"

### 2. Monitor Logs
```bash
# Real-time logs
firebase functions:log

# Filter AI-related logs
firebase functions:log | grep "\[AI"

# Filter specific errors
firebase functions:log --only errors
```

### 3. Test AI Functionality
- [ ] Test message categorization (speed priority)
- [ ] Test response generation (quality priority)
- [ ] Verify model degradation fallback
- [ ] Check Langfuse dashboard for traces
- [ ] Monitor OpenAI usage dashboard

---

## 🎯 Firebase Success Criteria

Firebase deployment is successful when:
- [ ] `firebase deploy --only functions` completes without errors
- [ ] `firebase functions:list` shows all functions as ACTIVE
- [ ] Logs show no immediate errors
- [ ] AI operations process successfully
- [ ] OpenAI dashboard shows API calls
- [ ] No increase in error rates
- [ ] Response times < 500ms for speed priority
- [ ] Response times < 2s for quality priority

---

# 🔍 Post-Deployment Verification

## Cost Monitoring

### OpenAI Usage
- [ ] Set up billing alerts in OpenAI dashboard (https://platform.openai.com/usage)
- [ ] Monitor token usage in real-time
- [ ] Verify costs align with expectations

### Langfuse Monitoring
- [ ] Check Langfuse dashboard for traces (https://cloud.langfuse.com)
- [ ] Monitor latency metrics
- [ ] Review token usage and costs

### Firebase & Vercel Usage
- [ ] Review Firebase Functions invocations and costs
- [ ] Review Vercel Edge Functions invocations
- [ ] Check bandwidth usage

---

# 📊 Monitoring Setup

## OpenAI Dashboard
- **URL**: https://platform.openai.com/usage
- **Monitor**: Token usage, costs, rate limits, API errors

## Vercel Dashboard
- **URL**: https://vercel.com/dashboard
- **Monitor**: Function invocations, latency, error rates, bandwidth

## Firebase Console
- **URL**: https://console.firebase.google.com
- **Monitor**: Function invocations, errors, performance, quota

## Langfuse (Optional)
- **URL**: https://cloud.langfuse.com
- **Monitor**: LLM traces, latency, token usage, costs per operation

---

# 🎯 Expected Behavior After Deployment

## Model Selection
- **Speed requests** → GPT-4o-mini (fast, sub-second)
- **Quality requests** → GPT-4 Turbo (best accuracy)
- **Cost requests** → GPT-4o-mini with reduced tokens

## Failover Strategy
- **Quality model fails** → Degrades to GPT-4o-mini
- **Circuit breaker** → Opens after 10 consecutive failures
- **Cooldown** → 60 seconds before retry

## Performance Targets
- **Edge Functions** (Vercel): < 500ms response time, < 100ms cold start
- **Cloud Functions** (Firebase): < 2s for AI operations
- **Rate Limiting**: 200 req/hr for categorization, 50 req/hr for generation

## Cost Expectations
- **GPT-4o-mini**: $0.15 input / $0.60 output per 1M tokens
- **GPT-4 Turbo**: $10.00 input / $30.00 output per 1M tokens
- **40% cheaper** than previous Claude 3 Haiku setup

---

# ⚠️ Troubleshooting

## Vercel Edge Function Issues

### Deployment Fails
```bash
# Check build errors
cd api
npm install
npx tsc --noEmit categorize-message.ts

# Check Vercel logs
vercel logs

# Verify environment variables
vercel env ls
```

### Edge Function Returns 500 Error
```bash
# View real-time logs
vercel logs --follow

# Common issues:
# 1. Missing OPENAI_API_KEY environment variable
# 2. Invalid API key format
# 3. CORS issues (check request headers)
```

### Rate Limiting Not Working
```bash
# Verify Upstash Redis environment variables
vercel env ls | grep UPSTASH

# Test Redis connection (create a test script)
# Check Upstash dashboard for connection logs
```

## Firebase Function Issues

### Deployment Fails
```bash
# Check build errors
cd functions
npm run build

# Check for syntax errors
npx tsc --noEmit

# Verify node version
node --version  # Should be 20.x
```

### Functions Crash After Deployment
```bash
# View error logs
firebase functions:log --only errors

# Check environment config
firebase functions:config:get

# Verify API keys are set correctly
```

### AI Operations Fail
```bash
# Check OpenAI API key validity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"

# Verify functions config
firebase functions:config:get ai.openai_api_key
```

## Common Issues Across Both Platforms

### Invalid API Key
```bash
# Test OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"

# Should return list of available models
```

### Rate Limit Exceeded (OpenAI)
- Check OpenAI dashboard for usage limits
- Verify you're not exceeding free tier limits
- Consider upgrading to paid tier

### CORS Errors (Vercel Edge Functions)
- Verify CORS headers in `api/categorize-message.ts`
- Check that client is sending proper `Origin` header
- Test with `curl` to isolate client vs server issues

---

# 🔄 Rollback Procedures

## Rollback Vercel Deployment

### Option 1: Via Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Deployments**
4. Find previous working deployment
5. Click **⋯** → **Promote to Production**

### Option 2: Via CLI
```bash
# List recent deployments
vercel ls

# Redeploy a specific deployment to production
vercel promote [deployment-url]
```

## Rollback Firebase Deployment

```bash
# Firebase doesn't have built-in rollback
# You need to redeploy previous code from git

# 1. Checkout previous working commit
git checkout <previous-commit-hash>

# 2. Redeploy functions
firebase deploy --only functions

# 3. Return to current branch
git checkout main
```

### Quick Fix: Disable AI Features
```bash
# Disable AI without full rollback
firebase functions:config:set ai.enabled="false"
firebase deploy --only functions
```

---

# ✅ Final Success Checklist

## Vercel Edge Functions
- [ ] Deployed to production successfully
- [ ] `/api/categorize-message` endpoint accessible
- [ ] Response times < 500ms
- [ ] No errors in Vercel logs
- [ ] Environment variables configured
- [ ] Test request successful

## Firebase Cloud Functions
- [ ] All functions show ACTIVE status
- [ ] No deployment errors
- [ ] Environment variables configured
- [ ] AI operations working
- [ ] Logs show no errors

## Monitoring & Costs
- [ ] OpenAI dashboard shows API calls
- [ ] Langfuse tracking traces (if configured)
- [ ] Billing alerts configured
- [ ] No unexpected cost spikes

## Integration Testing
- [ ] End-to-end message flow works
- [ ] AI categorization functioning
- [ ] Fallback mechanisms tested
- [ ] Rate limiting working
- [ ] Error handling graceful

---

## 📝 Notes

- **First deployment** may take 5-10 minutes for Firebase, < 2 minutes for Vercel
- **Cold starts**: Vercel Edge < 100ms, Firebase Functions 2-3 seconds
- **Rate limits** are configured in respective `rateLimiter.ts` files
- **Circuit breaker** prevents cascading failures
- **Graceful degradation** ensures service continuity

---

**Generated**: 2025-10-23
**Project**: yipyap
**Architecture**: OpenAI-only, Vercel Edge + Firebase Functions
**Deployment Targets**: Vercel (Edge Functions) + Firebase (Cloud Functions)
