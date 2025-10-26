# Firebase Cloud Functions Setup

## Prerequisites

Before deploying or testing Cloud Functions, complete these manual setup steps:

### 1. iOS APNs Configuration (Apple Push Notification service)

1. Log in to [Apple Developer Console](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create an **APNs Authentication Key**:
   - Click **Keys** → **+** (Add)
   - Enable **Apple Push Notifications service (APNs)**
   - Download the `.p8` file
   - Note the **Key ID** and **Team ID**
4. In [Firebase Console](https://console.firebase.google.com/):
   - Navigate to **Project Settings** → **Cloud Messaging**
   - Under **Apple app configuration**, upload the `.p8` file
   - Enter your **Key ID** and **Team ID**

### 2. Android FCM Configuration

1. In [Firebase Console](https://console.firebase.google.com/):
   - Navigate to **Project Settings** → **General**
   - Under **Your apps**, select your Android app
   - Download `google-services.json`
   - Place it in the **root directory** of the project (already in .gitignore)

### 3. FCM Service Account Credentials

1. In [Firebase Console](https://console.firebase.google.com/):
   - Navigate to **Project Settings** → **Service Accounts**
   - Click **Generate new private key**
   - Download the JSON file
   - Store securely (DO NOT commit to git)
2. For local development:
   - Set environment variable: `GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json`
3. For Firebase deployment:
   - Credentials are automatically available to Cloud Functions

### 4. Firebase CLI Authentication

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Select your project
firebase use --add

# Choose your Firebase project ID and give it an alias (e.g., "production")
```

## Development

### Install Dependencies

```bash
cd functions
npm install
```

### Build Functions

```bash
npm run build
```

### Run Functions Locally with Emulator

```bash
# From project root
npm run emulator

# Or from functions directory
npm run serve
```

### Deploy Functions

```bash
# From project root
firebase deploy --only functions

# Or specific function
firebase deploy --only functions:sendMessageNotification
```

## ⚠️ CRITICAL: Known Deployment Issues

### Firebase Gen2 Caching Bug

**ALWAYS READ THIS BEFORE DEPLOYING FUNCTIONS**

Firebase Cloud Functions Gen2 has a severe caching bug where functions serve stale code even after successful deployments.

#### Symptoms:
- Deployment succeeds but old code continues running
- Version markers don't appear in logs
- Changes take hours/days or never propagate
- Can happen multiple times (V2 can also get cached!)

#### Solution - Versioned Function Names:

1. **Add version marker to your code:**
   ```typescript
   const VERSION = 'v15.0-YOUR-CHANGE-DESCRIPTION';
   console.log(`[VERSION] ${VERSION}`);
   ```

2. **Deploy and verify:**
   ```bash
   firebase deploy --only functions:yourFunction
   # Wait 60 seconds, then trigger function and check logs
   ```

3. **If caching detected** (version marker doesn't appear):
   - Create NEW function with incremented version:
     ```typescript
     export const yourFunctionV3 = https.onCall(...)
     ```
   - Update client code to call new version
   - Deploy as CREATE operation (first time)
   - Fully restart client app

#### Example from This Project:
- `dailyAgentWorkflow` → stuck with cached code
- `dailyAgentWorkflowV2` → **ALSO cached!**
- `dailyAgentWorkflowV3` → working (current)

**Full documentation:** See project memory `firebase_gen2_caching_workaround`

### Common Firestore Data Access Bug

When working with `QueryDocumentSnapshot` objects:

```typescript
// ❌ WRONG - Accesses snapshot properties (often undefined)
messages.map(m => m.conversationId)

// ✅ CORRECT - Accesses document data
messages.map(m => m.data().conversationId)
```

Always use `.data()` to access document fields!

## Testing

Test files are located in `/tests/unit/services/` and `/functions/tests/`.

Run tests with Firebase Emulator:
```bash
npm run test:rules
```

## Notification Channels (Android)

Notification channels are configured programmatically in the app code.
See `/services/notificationService.ts` for channel setup.

## Monitoring

- View function logs: `firebase functions:log`
- Monitor in Firebase Console: **Functions** → **Logs**
- Set up alerts in **Monitoring** section
