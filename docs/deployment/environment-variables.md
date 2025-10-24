# Environment Variables Configuration

This guide covers environment variable configuration for all yipyap platforms.

## Overview

yipyap uses environment variables across three platforms:
1. **React Native App** (`.env.local`)
2. **Vercel Edge Functions** (Vercel Dashboard)
3. **Firebase Cloud Functions** (`functions/.env`)

---

## 1. React Native App

**File**: `.env.local` (root directory)
**Ignored by git**: Yes (in `.gitignore`)

### Required Variables

```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

# Vercel Edge Functions
EXPO_PUBLIC_VERCEL_EDGE_URL=https://api.yipyap.wtf

# AI Feature Flags
EXPO_PUBLIC_AI_ENABLED=true

# Langfuse Monitoring (Optional)
EXPO_PUBLIC_LANGFUSE_PUBLIC_KEY=your-public-key
EXPO_PUBLIC_LANGFUSE_SECRET_KEY=your-secret-key
EXPO_PUBLIC_LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### Usage in Code

```typescript
import { Config } from '@/constants/Config';

// Always use Config object, never process.env directly
const apiUrl = Config.ai.vercelEdgeUrl;
const aiEnabled = Config.ai.aiEnabled;
```

---

## 2. Vercel Edge Functions

**Location**: Vercel Dashboard → Project Settings → Environment Variables
**Applied to**: Production, Preview, Development

### Required Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API access | Yes |
| `LANGFUSE_PUBLIC_KEY` | Monitoring | Optional |
| `LANGFUSE_SECRET_KEY` | Monitoring | Optional |
| `UPSTASH_REDIS_REST_URL` | Rate limiting | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Optional |

### How to Set

**Via Dashboard**:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add each variable for all environments (Production, Preview, Development)

**Via CLI**:
```bash
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_API_KEY preview
vercel env add OPENAI_API_KEY development
```

### Verify Configuration

```bash
vercel env ls
```

---

## 3. Firebase Cloud Functions

**File**: `functions/.env`
**Ignored by git**: Yes (in `functions/.gitignore`)

### Modern Approach (.env files)

Firebase now uses `.env` files instead of the deprecated `functions.config()` API.

### Required Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# AI Feature Flags
AI_ENABLED=true

# Langfuse Monitoring (Optional)
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Upstash Redis (Optional)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Usage in Code

```typescript
// Access via process.env
const apiKey = process.env.OPENAI_API_KEY;
const aiEnabled = process.env.AI_ENABLED === 'true';
```

### Deployment

Environment variables are automatically deployed with functions:

```bash
firebase deploy --only functions
```

Look for this line in deployment output:
```
✅ functions: Loaded environment variables from .env.
```

---

## Security Best Practices

### ✅ Do

- Use `.env.example` files to document required variables (without actual values)
- Store secrets in environment variables, never in code
- Use different API keys for development/production
- Add `.env` and `.env.local` to `.gitignore`
- Share `.env` files securely (1Password, encrypted channels)

### ❌ Don't

- Commit `.env` or `.env.local` files to git
- Hardcode API keys in source code
- Share API keys in plain text (Slack, email, etc.)
- Use production API keys in development
- Commit service account keys or credentials

---

## Getting API Keys

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy and save the key (you won't see it again!)

### Langfuse (Optional)
1. Sign up at https://langfuse.com
2. Go to Settings → API Keys
3. Copy both public and secret keys

### Upstash Redis (Optional)
1. Sign up at https://upstash.com
2. Create a new Redis database
3. Copy the REST URL and REST Token

---

## Custom Domain Configuration

The Vercel Edge Functions use a custom domain:

**Domain**: `api.yipyap.wtf`
**DNS**: CNAME to Vercel

To configure:
1. Add domain in Vercel Dashboard
2. Add CNAME record at your DNS provider:
   ```
   Type:  CNAME
   Name:  api
   Value: cname.vercel-dns.com
   ```
3. Wait for DNS propagation (5 min - 48 hours)
4. Vercel auto-provisions SSL certificate

---

## Troubleshooting

### "Environment variable not found"

**React Native**:
```bash
# Restart Expo with cleared cache
npx expo start --clear
```

**Vercel**:
```bash
# Check variables are set
vercel env ls

# Redeploy to pick up new variables
vercel --prod
```

**Firebase**:
```bash
# Check .env file exists
cat functions/.env

# Redeploy functions
firebase deploy --only functions
```

### "Variables work locally but not in production"

- Ensure variables are set in production environment (not just development)
- For Vercel: Check all three environments (Production, Preview, Development)
- For Expo: Ensure you restarted the app/bundler after changing .env

### "API key is invalid"

- Verify key is correct (no extra spaces, quotes, etc.)
- Check key is active in the provider's dashboard
- Ensure you're using the right key for the environment
- Test key directly with provider's API

---

## Migration Notes

### Firebase: functions.config() → .env files

The old `functions.config()` API is deprecated (shutdown March 2026).

**Old way** (deprecated):
```bash
firebase functions:config:set ai.openai_api_key="key"
```

**New way** (current):
```bash
# Edit functions/.env directly
code functions/.env
```

All yipyap Firebase Functions now use the modern `.env` approach.
