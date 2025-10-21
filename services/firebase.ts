/**
 * Firebase initialization and service configuration
 * @remarks
 * This module initializes Firebase services (Auth, Firestore, Storage)
 * All Firebase access should go through this service layer, never directly from components
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
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
 * Initializes Firebase services with configuration from environment variables
 * @throws {Error} When Firebase configuration is missing or invalid
 * @example
 * ```typescript
 * initializeFirebase();
 * const auth = getFirebaseAuth();
 * ```
 */
export function initializeFirebase(): void {
  try {
    // Initialize Firebase app
    app = initializeApp(Config.firebase);

    // Initialize services
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Firebase initialized successfully
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
