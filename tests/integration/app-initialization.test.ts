/**
 * Integration tests for app initialization flow
 * Tests the complete initialization sequence including Firebase setup
 *
 * Note: These tests verify the integration between Config and Firebase service modules
 * without requiring actual Firebase credentials or network calls
 */

describe('App Initialization Integration Tests', () => {
  describe('Firebase Service Integration', () => {
    it('prevents access to services before initialization', () => {
      jest.resetModules();

      const {
        getFirebaseAuth,
        getFirebaseDb,
        getFirebaseStorage,
      } = require('../../services/firebase');

      // All getters should throw before initialization
      expect(() => getFirebaseAuth()).toThrow(
        'Firebase not initialized. Call initializeFirebase() first.'
      );

      expect(() => getFirebaseDb()).toThrow(
        'Firebase not initialized. Call initializeFirebase() first.'
      );

      expect(() => getFirebaseStorage()).toThrow(
        'Firebase not initialized. Call initializeFirebase() first.'
      );
    });

    it('handles initialization error gracefully with invalid config', () => {
      jest.resetModules();

      // Import the module with potentially invalid/empty config from environment
      const { initializeFirebase } = require('../../services/firebase');

      // If environment variables are not set (test environment), initialization should fail gracefully
      // This tests the error handling path in initializeFirebase
      expect(() => initializeFirebase()).toThrow(
        'Firebase initialization failed. Please check your configuration.'
      );
    });
  });

  describe('Config and Firebase Integration', () => {
    it('Config provides valid structure for Firebase initialization', () => {
      const { Config } = require('../../constants/Config');

      // Verify Config structure matches Firebase SDK requirements
      expect(Config.firebase).toHaveProperty('apiKey');
      expect(Config.firebase).toHaveProperty('authDomain');
      expect(Config.firebase).toHaveProperty('projectId');
      expect(Config.firebase).toHaveProperty('storageBucket');
      expect(Config.firebase).toHaveProperty('messagingSenderId');
      expect(Config.firebase).toHaveProperty('appId');

      // All required fields should be strings (empty or populated)
      expect(typeof Config.firebase.apiKey).toBe('string');
      expect(typeof Config.firebase.authDomain).toBe('string');
      expect(typeof Config.firebase.projectId).toBe('string');
      expect(typeof Config.firebase.storageBucket).toBe('string');
      expect(typeof Config.firebase.messagingSenderId).toBe('string');
      expect(typeof Config.firebase.appId).toBe('string');
    });

    it('Config structure is compatible with Firebase initializeApp', () => {
      const { Config } = require('../../constants/Config');
      const firebaseConfig = Config.firebase;

      // Verify the config object has the exact shape expected by Firebase SDK
      const requiredFields = [
        'apiKey',
        'authDomain',
        'projectId',
        'storageBucket',
        'messagingSenderId',
        'appId',
      ];

      requiredFields.forEach((field) => {
        expect(firebaseConfig).toHaveProperty(field);
        expect(typeof firebaseConfig[field as keyof typeof firebaseConfig]).toBe('string');
      });
    });
  });

  describe('Initialization Flow', () => {
    it('enforces correct initialization order', () => {
      jest.resetModules();

      const {
        getFirebaseAuth,
        getFirebaseDb,
        getFirebaseStorage,
      } = require('../../services/firebase');

      // Attempting to access services before init should fail
      expect(() => getFirebaseAuth()).toThrow();
      expect(() => getFirebaseDb()).toThrow();
      expect(() => getFirebaseStorage()).toThrow();

      // Error messages should guide developer to initialize first
      expect(() => getFirebaseAuth()).toThrow(/Call initializeFirebase/);
      expect(() => getFirebaseDb()).toThrow(/Call initializeFirebase/);
      expect(() => getFirebaseStorage()).toThrow(/Call initializeFirebase/);
    });

    it('provides clear error messages for common issues', () => {
      jest.resetModules();

      const { initializeFirebase, getFirebaseAuth } = require('../../services/firebase');

      // Test uninitialized access error message
      expect(() => getFirebaseAuth()).toThrow(
        'Firebase not initialized. Call initializeFirebase() first.'
      );

      // Test initialization error message (with invalid/missing config)
      expect(() => initializeFirebase()).toThrow(
        'Firebase initialization failed. Please check your configuration.'
      );
    });
  });

  describe('Environment Variable Integration', () => {
    it('Config module reads from process.env correctly', () => {
      const { Config } = require('../../constants/Config');

      // Config should handle undefined environment variables with fallback to empty string
      // This tests the || '' fallback mechanism
      expect(Config.firebase.apiKey).toBeDefined();
      expect(Config.firebase.apiKey).not.toBeUndefined();
      expect(Config.firebase.apiKey).not.toBeNull();

      // Should be a string (either from env or default empty string)
      expect(typeof Config.firebase.apiKey).toBe('string');
    });

    it('all Firebase config values default to strings when env vars missing', () => {
      const { Config } = require('../../constants/Config');

      // In test environment without .env.local, all values should be empty strings
      // This verifies the || '' fallback works for all fields
      Object.values(Config.firebase).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNull();
      });
    });
  });
});
