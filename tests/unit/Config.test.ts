/**
 * Tests for the Config module
 */

import { Config } from '../../constants/Config';

describe('Config', () => {
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
