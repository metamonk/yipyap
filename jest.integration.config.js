/**
 * Jest configuration for Integration Testing with Firebase Emulator
 *
 * This config uses Node.js environment with ESM support to properly handle
 * Firebase ES modules while maintaining support for React Native code.
 *
 * Run with: NODE_OPTIONS=--experimental-vm-modules jest --config jest.integration.config.js
 */

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2020',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          jsx: 'react',
          skipLibCheck: true,
          skipDefaultLibCheck: true,
          noEmit: true,
        },
        diagnostics: false, // Disable TypeScript diagnostics for integration tests
      },
    ],
  },
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/rules/',
    '<rootDir>/tests/e2e/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.ts'],
  testTimeout: 30000,
  // Mock modules that don't work in Node environment
  moduleNameMapper: {
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^@react-native/(.*)$': '<rootDir>/node_modules/@react-native/$1',
    '^@/services/firebase$': '<rootDir>/tests/__mocks__/firebase-service-integration.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(firebase|@firebase|@react-native|expo|expo-.*|@expo|react-native)/)',
  ],
};
