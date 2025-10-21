# Development Workflow

## Local Development Setup

### Prerequisites

```bash
# Required software
node --version  # v18.0.0 or higher
npm --version   # v9.0.0 or higher

# Install Expo CLI globally (optional but recommended)
npm install -g expo-cli eas-cli

# Install Firebase CLI for managing Firebase services
npm install -g firebase-tools
```

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/yipyap.git
cd yipyap

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Set up Firebase project
firebase login
firebase init  # Select Firestore, Storage, Functions (optional)

# Deploy Firebase rules and indexes
firebase deploy --only firestore:rules,firestore:indexes,storage:rules

# Start the development server
npm start
```

### Development Commands

```bash
# Start all services
npm start                    # Start Expo dev server

# Start frontend only
expo start --ios            # iOS Simulator (supports push notifications)
expo start --android        # Android Emulator (no push in Expo Go)
expo start --web           # Web browser (if configured)

# Start backend only
firebase emulators:start    # Local Firebase emulators

# Run tests
npm test                    # Run Jest tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# Linting and formatting
npm run lint               # Run ESLint
npm run lint:fix          # Fix linting issues
npm run format            # Run Prettier
```

## Environment Configuration

### Required Environment Variables

```bash
# Frontend (.env.local)
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

# Backend (.env) - for Cloud Functions if used
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Shared
ENVIRONMENT=development|staging|production
```

### Android Development Build Migration

When you need to test push notifications on Android (starting from Epic 3, Story 3.5):

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Configure EAS (first time only)
eas build:configure

# Create development build for Android
eas build --profile development --platform android

# Install the built APK on your device/emulator
# Then use it instead of Expo Go for Android development
```

**Note:** iOS developers can continue using Expo Go as it supports push notifications. The migration to Development Build only affects Android testing.

---
