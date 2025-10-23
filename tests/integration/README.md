# Integration Tests

Integration tests verify the complete flow of features using real Firebase connected to local emulators. These tests ensure that services, hooks, and components work together correctly with Firestore.

## Prerequisites

1. **Firebase CLI**: Install if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```

2. **Java Runtime**: Firebase emulators require Java. Install via:
   ```bash
   # macOS
   brew install openjdk@17

   # Verify installation
   java -version
   ```

## Running Integration Tests

### Option 1: Auto-start emulators (Recommended)

This command automatically starts emulators, runs tests, then stops emulators:

```bash
npm run test:integration:with-emulator
```

### Option 2: Manual emulator management

Start Firebase emulators in one terminal:
```bash
firebase emulators:start
```

Run integration tests in another terminal:
```bash
npm run test:integration
```

### Option 3: Run specific integration test

```bash
INTEGRATION_TEST=true npm test tests/integration/unread-count.test.ts
```

## How Integration Tests Work

1. **Environment Detection**: The `INTEGRATION_TEST` environment variable tells the test setup to use real Firebase instead of mocks.

2. **Firebase Initialization**: `tests/setup.ts` detects integration tests and:
   - Initializes real Firebase SDK
   - Connects to local emulators (not production!)
   - Provides emulator-connected instances to tests

3. **Emulator Configuration** (from `firebase.json`):
   - Firestore: `localhost:8080`
   - Realtime Database: `localhost:9000`
   - Storage: `localhost:9199`
   - Auth: `localhost:9099`

4. **Test Isolation**: Each test creates and cleans up its own test data using unique IDs.

## Writing Integration Tests

Integration tests should:

1. ✅ Test complete user flows (e.g., send message → unread count increments → open conversation → count resets)
2. ✅ Use real Firestore operations (not mocks)
3. ✅ Create test data in `beforeEach`, clean up in `afterEach`
4. ✅ Use unique IDs to prevent conflicts (e.g., `test-conv-${Date.now()}`)
5. ✅ Verify data changes in Firestore directly

Example structure:

```typescript
import { getFirebaseDb } from '@/services/firebase';
import { sendMessage } from '@/services/messageService';

describe('Feature Integration Tests', () => {
  const db = getFirebaseDb(); // Real Firestore connected to emulator
  let testId: string;

  beforeEach(async () => {
    testId = `test-${Date.now()}`;
    // Create test data
  });

  afterEach(async () => {
    // Clean up test data
  });

  it('should complete full user flow', async () => {
    // Test implementation using real Firebase operations
  });
});
```

## Troubleshooting

### "Firebase not initialized" Error

Make sure emulators are running:
```bash
firebase emulators:start
```

### "ECONNREFUSED localhost:8080" Error

Emulators aren't running or wrong ports. Check:
1. Is `firebase emulators:start` running?
2. Does `firebase.json` match the ports in `tests/setup.ts`?

### Tests Pass Locally But Fail in CI

Ensure CI pipeline:
1. Installs Java runtime
2. Starts Firebase emulators before running tests
3. Uses `npm run test:integration:with-emulator` (auto-starts emulators)

### Integration Tests Affecting Each Other

Make sure each test uses unique IDs and cleans up in `afterEach`. Use timestamps:
```typescript
const testId = `test-${Date.now()}-${Math.random()}`;
```

## Performance

Integration tests are slower than unit tests because they:
- Use real Firestore operations
- Write/read from emulator storage
- Execute full service layer logic

Expected test duration:
- Unit tests: ~10-50ms per test
- Integration tests: ~100-500ms per test

Keep integration tests focused on critical user flows. Use unit tests for edge cases and error handling.
