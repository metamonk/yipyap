/**
 * Mock implementation of firebase service for integration tests
 * Uses the Firebase instances initialized by setup.integration.ts
 */

declare global {
   
  var __FIREBASE_INITIALIZED__: boolean;
   
  var __FIREBASE_APP__: any;
   
  var __FIREBASE_DB__: any;
   
  var __FIREBASE_REALTIME_DB__: any;
   
  var __FIREBASE_AUTH__: any;
   
  var __FIREBASE_STORAGE__: any;
}

export function initializeFirebase(): void {
  // Firebase is already initialized by setup.integration.ts
  // This is a no-op for integration tests
  if (!global.__FIREBASE_INITIALIZED__) {
    throw new Error('Firebase should be initialized by setup.integration.ts before tests run');
  }
}

export function getFirebaseDb(): any {
  if (!global.__FIREBASE_DB__) {
    throw new Error('Firebase DB not initialized in global scope');
  }
  return global.__FIREBASE_DB__;
}

export function getFirebaseAuth(): any {
  if (!global.__FIREBASE_AUTH__) {
    throw new Error('Firebase Auth not initialized in global scope');
  }
  return global.__FIREBASE_AUTH__;
}

export function getFirebaseStorage(): any {
  if (!global.__FIREBASE_STORAGE__) {
    throw new Error('Firebase Storage not initialized in global scope');
  }
  return global.__FIREBASE_STORAGE__;
}

export function getRealtimeDb(): any {
  if (!global.__FIREBASE_REALTIME_DB__) {
    throw new Error('Firebase Realtime DB not initialized in global scope');
  }
  return global.__FIREBASE_REALTIME_DB__;
}

export function getFirebaseFunctions(): any {
  // Functions not typically needed for integration tests
  return null;
}
