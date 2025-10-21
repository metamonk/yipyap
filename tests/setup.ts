/**
 * Jest test setup file
 * Configures global test environment and mocks
 */

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
