/**
 * Tests for Firebase service module structure
 */

describe('Firebase Service', () => {
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
