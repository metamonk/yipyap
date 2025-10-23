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
