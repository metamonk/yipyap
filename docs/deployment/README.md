# Deployment Guide

This directory contains deployment documentation for the yipyap platform.

## Architecture Overview

yipyap uses a multi-platform deployment architecture:

```
┌─────────────────────────────────────────────────────────┐
│                     React Native App                     │
│                    (Expo / EAS Build)                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├──────────────────┬─────────────────────┐
                 │                  │                     │
                 ▼                  ▼                     ▼
┌────────────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Vercel Edge Functions │  │   Firebase   │  │    Firebase      │
│  api.yipyap.wtf        │  │   Firestore  │  │  Cloud Functions │
│                        │  │              │  │                  │
│  • AI Categorization   │  │  • Messages  │  │  • Push          │
│  • Real-time AI Ops    │  │  • Users     │  │    Notifications │
│                        │  │  • Convos    │  │                  │
│  GPT-4o-mini          │  │              │  │  Node.js 20      │
│  < 500ms latency      │  │  Rules       │  │  .env config     │
└────────────────────────┘  └──────────────┘  └──────────────────┘
```

## Quick Links

- [Deployment Checklist](./deployment-checklist.md) - Step-by-step deployment procedures
- [Current Status](./deployment-status.md) - What's currently deployed
- [Environment Variables](./environment-variables.md) - Configuration guide

## Platform Details

### Vercel Edge Functions
- **URL**: `https://api.yipyap.wtf`
- **Purpose**: Client-facing AI operations (message categorization)
- **Runtime**: Edge (global CDN, <100ms cold start)
- **Configuration**: Environment variables via Vercel Dashboard

### Firebase Cloud Functions
- **Region**: us-central1
- **Purpose**: Server-side operations (push notifications, future batch AI)
- **Runtime**: Node.js 20
- **Configuration**: `.env` file (modern approach, deprecated `functions.config()`)

### Firebase Infrastructure
- **Firestore**: NoSQL database with security rules
- **Storage**: File storage with security rules
- **Auth**: User authentication

### Mobile App (Expo)
- **Build System**: EAS (Expo Application Services)
- **Distribution**: App Store (iOS) + Google Play (Android)
- **Updates**: OTA updates via EAS Update

## Deployment Commands

### Backend

```bash
# Vercel Edge Functions
vercel --prod

# Firebase Functions + Infrastructure
firebase deploy --only functions,firestore,storage

# Test deployed API
./scripts/test-api-endpoint.sh
```

### Mobile App

```bash
# OTA Update (JavaScript changes only)
eas update --branch production --message "Update description"

# Full Build (native changes)
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```

## Environment Variables

All platforms use environment variables for configuration. See [environment-variables.md](./environment-variables.md) for details.

**Never commit**:
- `.env.local` (root project)
- `functions/.env` (Firebase Functions)
- API keys or secrets

## Monitoring

- **Vercel**: https://vercel.com/dashboard
- **Firebase**: https://console.firebase.google.com
- **OpenAI**: https://platform.openai.com/usage
- **Langfuse**: https://cloud.langfuse.com (optional)

## Support

For deployment issues, see:
- [Deployment Checklist](./deployment-checklist.md) - Troubleshooting section
- [GitHub Issues](https://github.com/your-org/yipyap/issues)
