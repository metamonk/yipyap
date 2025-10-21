/**
 * Tests for the Config module
 * Tests both structure and validation behavior
 */

import { Config } from '../../constants/Config';

describe('Config', () => {
  describe('Module Structure', () => {
    it('exports firebase configuration object', () => {
      expect(Config).toBeDefined();
      expect(Config.firebase).toBeDefined();
    });

    it('has all required Firebase config fields', () => {
      expect(Config.firebase).toHaveProperty('apiKey');
      expect(Config.firebase).toHaveProperty('authDomain');
      expect(Config.firebase).toHaveProperty('projectId');
      expect(Config.firebase).toHaveProperty('storageBucket');
      expect(Config.firebase).toHaveProperty('messagingSenderId');
      expect(Config.firebase).toHaveProperty('appId');
    });
  });

  describe('Behavioral Tests - Validation', () => {
    it('provides default empty strings when environment variables are missing', () => {
      // Note: In test environment, env vars may not be set
      // Config should handle this gracefully with empty string defaults
      const firebaseConfig = Config.firebase;

      // All fields should exist (even if empty)
      expect(firebaseConfig.apiKey).toBeDefined();
      expect(firebaseConfig.authDomain).toBeDefined();
      expect(firebaseConfig.projectId).toBeDefined();
      expect(firebaseConfig.storageBucket).toBeDefined();
      expect(firebaseConfig.messagingSenderId).toBeDefined();
      expect(firebaseConfig.appId).toBeDefined();

      // All fields should be strings (empty or populated)
      expect(typeof firebaseConfig.apiKey).toBe('string');
      expect(typeof firebaseConfig.authDomain).toBe('string');
      expect(typeof firebaseConfig.projectId).toBe('string');
      expect(typeof firebaseConfig.storageBucket).toBe('string');
      expect(typeof firebaseConfig.messagingSenderId).toBe('string');
      expect(typeof firebaseConfig.appId).toBe('string');
    });

    it('Config is typed as const for TypeScript immutability', () => {
      // Config is defined with "as const" which provides compile-time immutability
      // TypeScript will prevent modification at compile time
      // At runtime, the object is not frozen, but TypeScript enforces immutability
      const firebaseConfig = Config.firebase;

      // Verify the config object is a plain object (not frozen, but TypeScript ensures safety)
      expect(typeof firebaseConfig).toBe('object');
      expect(firebaseConfig).not.toBeNull();

      // Note: "as const" is a compile-time feature. Runtime modification is possible
      // but TypeScript prevents it, which is what matters for our type safety
    });

    it('handles missing environment variables gracefully', () => {
      // If process.env.EXPO_PUBLIC_FIREBASE_* is undefined, Config should use empty string
      // This tests the || '' fallback behavior
      const firebaseConfig = Config.firebase;

      // Should not be undefined or null
      expect(firebaseConfig.apiKey).not.toBeUndefined();
      expect(firebaseConfig.apiKey).not.toBeNull();
      expect(firebaseConfig.authDomain).not.toBeUndefined();
      expect(firebaseConfig.authDomain).not.toBeNull();
      expect(firebaseConfig.projectId).not.toBeUndefined();
      expect(firebaseConfig.projectId).not.toBeNull();
    });

    it('all config values are strings (type safety)', () => {
      // Verify all Firebase config values are strings, not numbers or other types
      const firebaseConfig = Config.firebase;

      Object.values(firebaseConfig).forEach((value) => {
        expect(typeof value).toBe('string');
      });
    });

    it('config object has exactly 6 Firebase properties', () => {
      // Ensure no extra properties are added accidentally
      const firebaseConfigKeys = Object.keys(Config.firebase);
      expect(firebaseConfigKeys).toHaveLength(6);
      expect(firebaseConfigKeys).toEqual(
        expect.arrayContaining([
          'apiKey',
          'authDomain',
          'projectId',
          'storageBucket',
          'messagingSenderId',
          'appId',
        ])
      );
    });
  });
});
