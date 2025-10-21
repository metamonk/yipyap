# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**

- **Platform:** Expo Application Services (EAS)
- **Build Command:** `eas build --platform all`
- **Output Directory:** Managed by EAS
- **CDN/Edge:** Expo's OTA update CDN for JavaScript bundle updates

**Backend Deployment:**

- **Platform:** Firebase (auto-managed)
- **Build Command:** `firebase deploy`
- **Deployment Method:** Firebase CLI deploys rules, indexes, and functions

## CI/CD Pipeline

```yaml
# .github/workflows/eas-build.yaml
name: EAS Build and Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run linter
        run: npm run lint

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build on EAS
        run: eas build --platform all --non-interactive

      - name: Submit to stores (production only)
        if: github.ref == 'refs/heads/main'
        run: eas submit --platform all --latest
```

## Environments

| Environment | Frontend URL               | Backend URL                            | Purpose                |
| ----------- | -------------------------- | -------------------------------------- | ---------------------- |
| Development | expo://localhost:19000     | http://localhost:9099 (emulator)       | Local development      |
| Staging     | https://staging.yipyap.app | https://yipyap-staging.firebaseapp.com | Pre-production testing |
| Production  | App Store / Google Play    | https://yipyap.firebaseapp.com         | Live environment       |

---
