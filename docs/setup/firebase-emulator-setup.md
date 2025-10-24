# Firebase Emulator Setup Guide

This guide explains how to set up and run Firebase Emulators for local development and testing.

## Overview

Firebase Emulator Suite allows you to run local versions of Firebase services for development and testing without affecting production data. The yipyap project uses emulators for:

- **Firestore**: Database for messages, conversations, users
- **Authentication**: User authentication and authorization
- **Functions**: Cloud Functions for background processing
- **Realtime Database**: Presence and typing indicators

## Prerequisites

- Node.js 18+ installed
- Java JDK 11+ installed (required for Firestore emulator)
- Firebase CLI installed globally: `npm install -g firebase-tools`

### Verify Java Installation

```bash
java -version
```

Expected output:
```
openjdk version "11.0.x" or higher
```

If Java is not installed:

**macOS (using Homebrew)**:
```bash
brew install openjdk@17
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get update
sudo apt-get install openjdk-17-jdk
```

**Windows**:
Download and install from [AdoptOpenJDK](https://adoptopenjdk.net/)

## Installation

1. **Install Firebase CLI** (if not already installed):
```bash
npm install -g firebase-tools
```

2. **Verify Firebase CLI**:
```bash
firebase --version
```

3. **Login to Firebase**:
```bash
firebase login
```

4. **Initialize Firebase in project** (if not already done):
```bash
cd /path/to/yipyap
firebase init
```

Select:
- Firestore
- Functions
- Emulators

## Configuration

The project includes `firebase.json` with emulator configuration:

```json
{
  "emulators": {
    "auth": {
      "port": 9099,
      "host": "127.0.0.1"
    },
    "firestore": {
      "port": 8080,
      "host": "127.0.0.1"
    },
    "database": {
      "port": 9000,
      "host": "127.0.0.1"
    },
    "functions": {
      "port": 5001,
      "host": "127.0.0.1"
    },
    "ui": {
      "enabled": true,
      "port": 4000,
      "host": "127.0.0.1"
    }
  }
}
```

## Running Emulators

### Start All Emulators

```bash
firebase emulators:start
```

This starts:
- Firestore emulator on port 8080
- Auth emulator on port 9099
- Realtime Database emulator on port 9000
- Functions emulator on port 5001
- Emulator UI on port 4000

### Start Specific Emulators

```bash
# Only Firestore and Auth
firebase emulators:start --only firestore,auth

# Only Firestore for quick testing
firebase emulators:start --only firestore
```

### Start with Import/Export

```bash
# Export data on exit
firebase emulators:start --export-on-exit=./emulator-data

# Import data on start
firebase emulators:start --import=./emulator-data
```

## Running Tests with Emulators

### Integration Tests

The project includes integration tests that require emulators:

```bash
# Terminal 1: Start emulators
firebase emulators:start --only firestore,auth

# Terminal 2: Run integration tests
npm run test:integration
```

### Automated Test Workflow

Use the Firebase Emulators Exec command to automatically start/stop emulators:

```bash
firebase emulators:exec "npm run test:integration"
```

This will:
1. Start emulators
2. Run tests
3. Stop emulators automatically

### Jest Configuration

Integration tests use environment variables to connect to emulators:

```javascript
// jest.integration.config.js
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000';
```

### Test Files Requiring Emulators

From Story 5.7:
- `tests/integration/dashboard-integration.test.ts` (requires Firestore + Auth)
- `tests/integration/dashboard-realtime.test.ts` (requires Firestore + Realtime Database)

From other stories:
- `tests/integration/firestore-query-optimization.test.ts`
- `tests/integration/sentiment-performance.test.ts`
- `tests/integration/voice-security-rules.test.ts`

## Emulator UI

Access the Emulator UI at: `http://localhost:4000`

Features:
- View Firestore collections and documents
- View Auth users
- View Realtime Database data
- View Functions logs
- Clear all data
- Import/export data

## Troubleshooting

### Port Already in Use

If ports are already in use, change them in `firebase.json`:

```json
{
  "emulators": {
    "firestore": {
      "port": 8888  // Changed from 8080
    }
  }
}
```

Or kill processes using the ports:

```bash
# macOS/Linux
lsof -ti:8080 | xargs kill -9
lsof -ti:9099 | xargs kill -9

# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Java Not Found

Error: `Error: java: command not found`

Solution:
```bash
# Find Java installation
/usr/libexec/java_home

# Set JAVA_HOME
export JAVA_HOME=$(/usr/libexec/java_home)
export PATH="$JAVA_HOME/bin:$PATH"

# Add to shell profile
echo 'export JAVA_HOME=$(/usr/libexec/java_home)' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Firestore Rules Not Loading

Error: `Firestore Rules validation failed`

Solution:
1. Check `firebase/firestore.rules` exists
2. Verify rules syntax:
```bash
firebase deploy --only firestore:rules --dry-run
```

3. Restart emulators:
```bash
firebase emulators:start --only firestore
```

### Tests Failing with "Firebase not initialized"

Error: `Firebase not initialized` in integration tests

Solution:
1. Ensure emulators are running:
```bash
firebase emulators:start --only firestore,auth
```

2. Verify environment variables in test setup:
```javascript
// tests/setup.integration.ts
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
```

3. Initialize Firebase before tests:
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// In test setup
const app = initializeApp({ projectId: 'demo-test' });
const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);
```

### Slow Emulator Startup

If emulators take >30s to start:

1. Clear emulator cache:
```bash
rm -rf ~/.cache/firebase/emulators
```

2. Reduce emulator load:
```bash
# Only start needed emulators
firebase emulators:start --only firestore
```

3. Check Java heap size:
```bash
export JAVA_OPTS="-Xmx2048m"
firebase emulators:start
```

## Best Practices

### 1. Use Separate Data for Tests

```bash
# Clear data before each test suite
firebase emulators:start --import=./seed-data
```

### 2. Automated CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run Integration Tests
  run: |
    firebase emulators:exec --only firestore,auth "npm run test:integration"
```

### 3. Seed Data for Development

Create seed data in `emulator-data/` directory:

```bash
# Export current state
firebase emulators:start --export-on-exit=./emulator-data

# Import for development
firebase emulators:start --import=./emulator-data
```

### 4. Security Rules Testing

Test security rules with emulators:

```bash
# Run rules unit tests
npm run test:rules

# Or with emulator running
firebase emulators:exec "npm run test:rules"
```

### 5. Performance Testing

Use emulators for performance testing:

```javascript
// tests/integration/performance.test.ts
test('dashboard loads in <1s', async () => {
  const start = Date.now();
  await dashboardService.getDailySummary('user-id');
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000);
});
```

## Quick Reference

```bash
# Start all emulators
firebase emulators:start

# Start specific emulators
firebase emulators:start --only firestore,auth

# Run tests with emulators
firebase emulators:exec "npm test"

# Export data
firebase emulators:start --export-on-exit=./data

# Import data
firebase emulators:start --import=./data

# Stop emulators
Ctrl+C in terminal

# View logs
firebase emulators:start --debug
```

## NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "emulators": "firebase emulators:start",
    "emulators:test": "firebase emulators:exec 'npm test'",
    "emulators:integration": "firebase emulators:exec 'npm run test:integration'",
    "test:integration": "jest --config=jest.integration.config.js",
    "test:integration:with-emulator": "firebase emulators:exec --only firestore,auth 'jest --config=jest.integration.config.js'"
  }
}
```

Usage:
```bash
npm run emulators              # Start emulators
npm run emulators:test         # Run tests with emulators
npm run test:integration:with-emulator  # Integration tests with auto-start/stop
```

## Resources

- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Security Rules Unit Testing](https://firebase.google.com/docs/rules/unit-tests)

---

**Last Updated**: 2025-10-24
**Author**: James (Dev Agent)
**QA Reference**: `docs/qa/gates/5.7-creator-command-center-dashboard.yml` (TEST-002)
