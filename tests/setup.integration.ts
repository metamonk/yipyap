/**
 * Jest setup file for Integration Tests
 * Connects to Firebase Emulator without mocking Firebase services
 */

// Note: We don't import '@testing-library/jest-native/extend-expect' here
// because integration tests run in Node environment, not React Native

// Global flag to prevent re-initialization
declare global {
  // eslint-disable-next-line no-var
  var __FIREBASE_INITIALIZED__: boolean;
  // eslint-disable-next-line no-var
  var __FIREBASE_APP__: any;
  // eslint-disable-next-line no-var
  var __FIREBASE_DB__: any;
  // eslint-disable-next-line no-var
  var __FIREBASE_REALTIME_DB__: any;
  // eslint-disable-next-line no-var
  var __FIREBASE_AUTH__: any;
  // eslint-disable-next-line no-var
  var __FIREBASE_STORAGE__: any;
}

// Initialize Firebase and connect to emulators
// This runs once before all tests
beforeAll(async () => {
  if (global.__FIREBASE_INITIALIZED__) {
    return; // Already initialized
  }

  // Import real Firebase modules (not mocked)
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
  const { getDatabase, connectDatabaseEmulator } = await import('firebase/database');
  const { getAuth, connectAuthEmulator } = await import('firebase/auth');
  const { getStorage, connectStorageEmulator } = await import('firebase/storage');

  // Initialize Firebase app
  const testFirebaseConfig = {
    apiKey: 'test-api-key',
    authDomain: 'test-project.firebaseapp.com',
    projectId: 'test-project',
    storageBucket: 'test-project.appspot.com',
    messagingSenderId: '123456789',
    appId: 'test-app-id',
  };

  const app = initializeApp(testFirebaseConfig);

  // Connect to Firebase Emulators
  const db = getFirestore(app);
  connectFirestoreEmulator(db, 'localhost', 8080);

  const realtimeDb = getDatabase(app);
  connectDatabaseEmulator(realtimeDb, 'localhost', 9000);

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

  const storage = getStorage(app);
  connectStorageEmulator(storage, 'localhost', 9199);

  // Store references globally
  global.__FIREBASE_APP__ = app;
  global.__FIREBASE_DB__ = db;
  global.__FIREBASE_REALTIME_DB__ = realtimeDb;
  global.__FIREBASE_AUTH__ = auth;
  global.__FIREBASE_STORAGE__ = storage;
  global.__FIREBASE_INITIALIZED__ = true;

  console.log('✓ Firebase Emulator connection initialized for integration tests');
});

// Helper to authenticate as a test user (bypasses security rules)
beforeEach(async () => {
  const { signInAnonymously } = await import('firebase/auth');
  const auth = global.__FIREBASE_AUTH__;

  // Sign in anonymously before each test to have valid auth context
  // This allows tests to write data while respecting security rules
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.warn('Failed to sign in anonymously for test:', error);
  }
});

// Sign out after each test
afterEach(async () => {
  const { signOut } = await import('firebase/auth');
  const auth = global.__FIREBASE_AUTH__;

  try {
    await signOut(auth);
  } catch (error) {
    // Ignore signout errors
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (global.__FIREBASE_APP__) {
    const { deleteApp } = await import('firebase/app');
    await deleteApp(global.__FIREBASE_APP__);
    global.__FIREBASE_INITIALIZED__ = false;
    console.log('✓ Firebase app cleaned up');
  }
});
