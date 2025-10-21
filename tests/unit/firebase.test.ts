/**
 * Tests for Firebase service module
 * Tests both structure (exports) and behavior (error handling, initialization)
 */

describe('Firebase Service', () => {
  describe('Module Structure', () => {
    it('exports expected functions', async () => {
      const firebaseModule = await import('../../services/firebase');

      expect(firebaseModule.initializeFirebase).toBeDefined();
      expect(firebaseModule.getFirebaseAuth).toBeDefined();
      expect(firebaseModule.getFirebaseDb).toBeDefined();
      expect(firebaseModule.getFirebaseStorage).toBeDefined();
    });

    it('functions are callable', async () => {
      const firebaseModule = await import('../../services/firebase');

      expect(typeof firebaseModule.initializeFirebase).toBe('function');
      expect(typeof firebaseModule.getFirebaseAuth).toBe('function');
      expect(typeof firebaseModule.getFirebaseDb).toBe('function');
      expect(typeof firebaseModule.getFirebaseStorage).toBe('function');
    });
  });

  describe('Behavioral Tests', () => {
    describe('Error Handling - Uninitialized Access', () => {
      it('getFirebaseAuth throws error when Firebase not initialized', () => {
        // Create fresh module instance to ensure uninitialized state
        jest.resetModules();
        const { getFirebaseAuth } = require('../../services/firebase');

        expect(() => getFirebaseAuth()).toThrow(
          'Firebase not initialized. Call initializeFirebase() first.'
        );
      });

      it('getFirebaseDb throws error when Firebase not initialized', () => {
        jest.resetModules();
        const { getFirebaseDb } = require('../../services/firebase');

        expect(() => getFirebaseDb()).toThrow(
          'Firebase not initialized. Call initializeFirebase() first.'
        );
      });

      it('getFirebaseStorage throws error when Firebase not initialized', () => {
        jest.resetModules();
        const { getFirebaseStorage } = require('../../services/firebase');

        expect(() => getFirebaseStorage()).toThrow(
          'Firebase not initialized. Call initializeFirebase() first.'
        );
      });
    });

    describe('Initialization with Invalid Configuration', () => {
      it('initializeFirebase throws error with invalid/missing config', () => {
        jest.resetModules();

        // Mock Config with invalid Firebase config
        jest.mock('../../constants/Config', () => ({
          Config: {
            firebase: {
              apiKey: '',
              authDomain: '',
              projectId: '',
              storageBucket: '',
              messagingSenderId: '',
              appId: '',
            },
          },
        }));

        const { initializeFirebase } = require('../../services/firebase');

        expect(() => initializeFirebase()).toThrow(
          'Firebase initialization failed. Please check your configuration.'
        );

        jest.unmock('../../constants/Config');
      });
    });

    describe('Successful Initialization Flow', () => {
      it('successfully initializes and provides access to all services', () => {
        jest.resetModules();

        // Mock valid Firebase configuration
        jest.mock('../../constants/Config', () => ({
          Config: {
            firebase: {
              apiKey: 'test-api-key',
              authDomain: 'test.firebaseapp.com',
              projectId: 'test-project',
              storageBucket: 'test.appspot.com',
              messagingSenderId: '123456789',
              appId: 'test-app-id',
            },
          },
        }));

        const {
          initializeFirebase,
          getFirebaseAuth,
          getFirebaseDb,
          getFirebaseStorage,
        } = require('../../services/firebase');

        // Should not throw
        expect(() => initializeFirebase()).not.toThrow();

        // Services should be accessible after initialization
        expect(() => getFirebaseAuth()).not.toThrow();
        expect(() => getFirebaseDb()).not.toThrow();
        expect(() => getFirebaseStorage()).not.toThrow();

        jest.unmock('../../constants/Config');
      });
    });
  });
});
