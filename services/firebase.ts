/**
 * Firebase initialization and service configuration
 * @remarks
 * This module initializes Firebase services (Auth, Firestore, Storage)
 * All Firebase access should go through this service layer, never directly from components
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { Auth, initializeAuth, getAuth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence is exported in React Native builds but not in TS types
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeFirestore,
  Firestore,
  persistentLocalCache,
  memoryLocalCache,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import { Config } from '@/constants/Config';

/**
 * Firebase app instance
 */
let app: FirebaseApp;

/**
 * Firebase Auth instance
 */
let auth: Auth;

/**
 * Firestore database instance
 */
let db: Firestore;

/**
 * Firebase Storage instance
 */
let storage: FirebaseStorage;

/**
 * Firebase Realtime Database instance
 */
let realtimeDb: Database;

/**
 * Initializes Firebase services with configuration from environment variables
 * @throws {Error} When Firebase configuration is missing or invalid
 * @example
 * ```typescript
 * initializeFirebase();
 * const auth = getFirebaseAuth();
 * ```
 */
export function initializeFirebase(): void {
  // Skip if already initialized (e.g., during hot reload)
  if (app) {
    return;
  }

  try {
    // Initialize Firebase app
    app = initializeApp(Config.firebase);

    // Initialize services
    // Configure Firebase Auth with AsyncStorage persistence for React Native
    // This ensures session persistence across dev server restarts and app reloads
    try {
      if (typeof getReactNativePersistence === 'function') {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } else {
        throw new Error('getReactNativePersistence not available');
      }
    } catch (persistenceError) {
      console.warn(
        'Failed to initialize with AsyncStorage persistence, using default:',
        persistenceError
      );
      // Fallback to default persistence (should still work in RN)
      auth = getAuth(app);
    }

    // Initialize Firestore with offline persistence enabled
    // This caches data locally for faster access and offline support
    // Offline behavior:
    // - All reads cached locally
    // - All writes queued locally when offline
    // - Queued writes automatically sent when connection restored
    // - Real-time listeners (onSnapshot) automatically reconnect
    // - Cached data available instantly on app restart
    db = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });

    storage = getStorage(app);

    // Initialize Realtime Database for presence system
    // RTDB provides instant status updates via onDisconnect handlers
    // Used for presence and typing indicators (not for primary data storage)
    realtimeDb = getDatabase(app);

    // CRITICAL FIX: Removed conflicting network management
    // Firestore handles network state automatically with offline persistence
    // Manual enableNetwork/disableNetwork calls were blocking cached queries
    // See: docs/architecture/critical-infrastructure-fixes.md
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw new Error('Firebase initialization failed. Please check your configuration.');
  }
}

/**
 * Returns the Firebase Auth instance
 * @returns Firebase Auth instance for authentication operations
 * @throws {Error} When Firebase has not been initialized
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return auth;
}

/**
 * Returns the Firestore database instance
 * @returns Firestore instance for database operations
 * @throws {Error} When Firebase has not been initialized
 */
export function getFirebaseDb(): Firestore {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
}

/**
 * Returns the Firebase Storage instance
 * @returns Firebase Storage instance for file operations
 * @throws {Error} When Firebase has not been initialized
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return storage;
}

/**
 * Returns the Firebase Realtime Database instance
 * @returns Firebase Realtime Database instance for presence and typing indicators
 * @throws {Error} When Firebase has not been initialized
 * @remarks
 * RTDB is used exclusively for real-time features (presence, typing indicators).
 * For all other data, use getFirebaseDb() to access Firestore.
 */
export function getFirebaseRealtimeDb(): Database {
  if (!realtimeDb) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return realtimeDb;
}
