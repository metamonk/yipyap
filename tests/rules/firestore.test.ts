/**
 * Firestore Security Rules Unit Tests
 *
 * Tests validate that Firestore security rules correctly enforce:
 * 1. Users can only read/write their own user document
 * 2. Username uniqueness validation prevents duplicate usernames
 * 3. Unauthenticated requests are denied (except username reads)
 *
 * @requires Firebase Emulator running on port 8080
 * @jest-environment node
 */

/* eslint-env jest */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper function to create a valid user document for testing
 */
function createValidUserData(uid: string, username: string, displayName: string) {
  return {
    uid,
    username,
    displayName,
    email: `${username}@test.com`,
    presence: {
      status: 'online',
      lastSeen: new Date(),
    },
    settings: {
      sendReadReceipts: true,
      notificationsEnabled: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Initialize test environment with security rules
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-yipyap-test',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../firebase/firestore.rules'), 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    // Clean up test environment
    await testEnv.cleanup();
  });

  afterEach(async () => {
    // Clear all data between tests
    await testEnv.clearFirestore();
  });

  describe('Users Collection - Read Access', () => {
    it('allows authenticated user to read their own user document', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      await assertSucceeds(userDoc.get());
    });

    it('allows authenticated user to read another user document (needed for search)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const bobDoc = alice.firestore().collection('users').doc('bob-uid');

      await assertSucceeds(bobDoc.get());
    });

    it('denies unauthenticated user from reading any user document', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const userDoc = unauthed.firestore().collection('users').doc('alice-uid');

      await assertFails(userDoc.get());
    });
  });

  describe('Users Collection - Write Access', () => {
    it('allows authenticated user to create their own user document', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      await assertSucceeds(userDoc.set(createValidUserData('alice-uid', 'alice', 'Alice')));
    });

    it('allows authenticated user to update their own user document', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      // Create document first
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('alice-uid')
          .set(createValidUserData('alice-uid', 'alice', 'Alice'));
      });

      // Update should succeed with valid data
      await assertSucceeds(userDoc.set(createValidUserData('alice-uid', 'alice', 'Alice Updated')));
    });

    it('denies authenticated user from creating another user document', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const bobDoc = alice.firestore().collection('users').doc('bob-uid');

      await assertFails(bobDoc.set(createValidUserData('bob-uid', 'bob', 'Bob')));
    });

    it('denies authenticated user from updating another user document', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');

      // Create Bob's document using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('bob-uid')
          .set(createValidUserData('bob-uid', 'bob', 'Bob'));
      });

      // Alice tries to update Bob's document - should fail
      const bobDoc = alice.firestore().collection('users').doc('bob-uid');
      await assertFails(bobDoc.set(createValidUserData('bob-uid', 'bob', 'Hacked by Alice')));
    });

    it('denies unauthenticated user from creating any user document', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const userDoc = unauthed.firestore().collection('users').doc('alice-uid');

      await assertFails(userDoc.set(createValidUserData('alice-uid', 'alice', 'Alice')));
    });

    it('denies unauthenticated user from updating any user document', async () => {
      // Create document using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('alice-uid')
          .set(createValidUserData('alice-uid', 'alice', 'Alice'));
      });

      const unauthed = testEnv.unauthenticatedContext();
      const userDoc = unauthed.firestore().collection('users').doc('alice-uid');

      await assertFails(userDoc.set(createValidUserData('alice-uid', 'alice', 'Hacked')));
    });
  });

  describe('Users Collection - Data Validation', () => {
    it('denies user document creation with missing required fields', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      // Missing required fields like presence, settings, etc.
      await assertFails(
        userDoc.set({
          uid: 'alice-uid',
          username: 'alice',
          displayName: 'Alice',
        })
      );
    });

    it('denies user document creation with invalid uid (not matching auth)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('wrong-uid', 'alice', 'Alice');
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with username too short (< 3 chars)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'ab', 'Alice');
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with username too long (> 20 chars)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'a'.repeat(21), 'Alice');
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with invalid username format (uppercase)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'Alice', 'Alice');
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with invalid username format (special chars)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'alice@test', 'Alice');
      await assertFails(userDoc.set(invalidData));
    });

    it('allows user document creation with valid username (lowercase alphanumeric + underscore)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const validData = createValidUserData('alice-uid', 'alice_123', 'Alice');
      await assertSucceeds(userDoc.set(validData));
    });

    it('denies user document creation with displayName too long (> 50 chars)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'alice', 'A'.repeat(51));
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with empty displayName', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'alice', '');
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with invalid presence status', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'alice', 'Alice');
      invalidData.presence.status = 'invalid' as unknown as 'online' | 'offline' | 'away';
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with missing presence.lastSeen', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'alice', 'Alice');
       
      delete (invalidData.presence as any).lastSeen;
      await assertFails(userDoc.set(invalidData));
    });

    it('denies user document creation with invalid settings type', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const invalidData = createValidUserData('alice-uid', 'alice', 'Alice');
      invalidData.settings.sendReadReceipts = 'true' as unknown as boolean; // Should be boolean
      await assertFails(userDoc.set(invalidData));
    });

    it('allows user document creation with optional photoURL field', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const validData = {
        ...createValidUserData('alice-uid', 'alice', 'Alice'),
        photoURL: 'https://example.com/photo.jpg',
      };
      await assertSucceeds(userDoc.set(validData));
    });

    it('allows user document creation with optional fcmToken field', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const userDoc = alice.firestore().collection('users').doc('alice-uid');

      const validData = {
        ...createValidUserData('alice-uid', 'alice', 'Alice'),
        fcmToken: 'test-fcm-token-123',
      };
      await assertSucceeds(userDoc.set(validData));
    });
  });

  describe('Usernames Collection - Read Access', () => {
    it('allows authenticated user to read username documents for availability check', async () => {
      // Create a username document
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('usernames').doc('alice').set({
          uid: 'alice-uid',
        });
      });

      const bob = testEnv.authenticatedContext('bob-uid');
      const usernameDoc = bob.firestore().collection('usernames').doc('alice');

      await assertSucceeds(usernameDoc.get());
    });

    it('allows unauthenticated user to read username documents for availability check', async () => {
      // Create a username document
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('usernames').doc('alice').set({
          uid: 'alice-uid',
        });
      });

      const unauthed = testEnv.unauthenticatedContext();
      const usernameDoc = unauthed.firestore().collection('usernames').doc('alice');

      // Username reads are public for availability checks
      await assertSucceeds(usernameDoc.get());
    });
  });

  describe('Usernames Collection - Write Access', () => {
    it('allows authenticated user to create username claim with matching uid', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const usernameDoc = alice.firestore().collection('usernames').doc('alice');

      await assertSucceeds(
        usernameDoc.set({
          uid: 'alice-uid',
        })
      );
    });

    it('denies authenticated user from creating username claim with different uid', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const usernameDoc = alice.firestore().collection('usernames').doc('bob');

      // Alice tries to claim username 'bob' with Bob's uid
      await assertFails(
        usernameDoc.set({
          uid: 'bob-uid',
        })
      );
    });

    it('denies authenticated user from updating username claims', async () => {
      // Create username document
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('usernames').doc('alice').set({
          uid: 'alice-uid',
        });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const usernameDoc = alice.firestore().collection('usernames').doc('alice');

      // Usernames are immutable - updates should fail
      await assertFails(
        usernameDoc.update({
          uid: 'new-uid',
        })
      );
    });

    it('denies authenticated user from deleting username claims', async () => {
      // Create username document
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('usernames').doc('alice').set({
          uid: 'alice-uid',
        });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const usernameDoc = alice.firestore().collection('usernames').doc('alice');

      // Usernames are permanent - deletes should fail
      await assertFails(usernameDoc.delete());
    });

    it('denies unauthenticated user from creating username claims', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const usernameDoc = unauthed.firestore().collection('usernames').doc('alice');

      await assertFails(
        usernameDoc.set({
          uid: 'alice-uid',
        })
      );
    });
  });

  describe('FAQ Templates Collection - Read Access (Story 5.4, Subtask 4.2)', () => {
    beforeEach(async () => {
      // Seed FAQ template for tests
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await firestore.collection('faq_templates').doc('faq1').set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });

    it('allows creator to read their own FAQ template', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq1');

      await assertSucceeds(faqDoc.get());
    });

    it('denies non-creator from reading FAQ template', async () => {
      const bob = testEnv.authenticatedContext('bob-uid');
      const faqDoc = bob.firestore().collection('faq_templates').doc('faq1');

      await assertFails(faqDoc.get());
    });

    it('denies unauthenticated user from reading FAQ templates', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const faqDoc = unauthed.firestore().collection('faq_templates').doc('faq1');

      await assertFails(faqDoc.get());
    });
  });

  describe('FAQ Templates Collection - Create Access (Story 5.4, Subtask 4.3)', () => {
    it('allows user to create FAQ template with valid data', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq-new');

      await assertSucceeds(
        faqDoc.set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('denies creating FAQ template with mismatched creatorId', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq-new');

      await assertFails(
        faqDoc.set({
          creatorId: 'bob-uid', // Mismatch with authenticated user
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('denies creating FAQ template without required fields', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq-new');

      await assertFails(
        faqDoc.set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          // Missing answer, keywords, category, etc.
        })
      );
    });

    it('denies creating FAQ template with empty question', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq-new');

      await assertFails(
        faqDoc.set({
          creatorId: 'alice-uid',
          question: '', // Empty question
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('denies creating FAQ template with non-zero useCount', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq-new');

      await assertFails(
        faqDoc.set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 5, // Must start at 0
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('denies unauthenticated user from creating FAQ templates', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const faqDoc = unauthed.firestore().collection('faq_templates').doc('faq-new');

      await assertFails(
        faqDoc.set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });
  });

  describe('FAQ Templates Collection - Update Access (Story 5.4, Subtask 4.4 - CreatorId Immutability)', () => {
    beforeEach(async () => {
      // Seed FAQ template for update tests
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await firestore.collection('faq_templates').doc('faq1').set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });

    it('allows creator to update their own FAQ template', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq1');

      await assertSucceeds(
        faqDoc.update({
          answer: 'Updated rates: $150 per hour.',
          updatedAt: new Date(),
        })
      );
    });

    it('denies non-creator from updating FAQ template', async () => {
      const bob = testEnv.authenticatedContext('bob-uid');
      const faqDoc = bob.firestore().collection('faq_templates').doc('faq1');

      await assertFails(
        faqDoc.update({
          answer: 'Hacked answer!',
        })
      );
    });

    it('denies changing creatorId during update', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq1');

      await assertFails(
        faqDoc.update({
          creatorId: 'bob-uid', // Attempt to change creatorId
          answer: 'Updated answer',
        })
      );
    });

    it('allows updating isActive status', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq1');

      await assertSucceeds(
        faqDoc.update({
          isActive: false,
          updatedAt: new Date(),
        })
      );
    });

    it('allows updating useCount', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq1');

      await assertSucceeds(
        faqDoc.update({
          useCount: 5,
          lastUsedAt: new Date(),
        })
      );
    });

    it('denies unauthenticated user from updating FAQ templates', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const faqDoc = unauthed.firestore().collection('faq_templates').doc('faq1');

      await assertFails(
        faqDoc.update({
          answer: 'Unauthenticated update',
        })
      );
    });
  });

  describe('FAQ Templates Collection - Delete Access (Story 5.4)', () => {
    beforeEach(async () => {
      // Seed FAQ template for delete tests
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await firestore.collection('faq_templates').doc('faq1').set({
          creatorId: 'alice-uid',
          question: 'What are your rates?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates', 'cost'],
          category: 'pricing',
          isActive: true,
          useCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });

    it('allows creator to delete their own FAQ template', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const faqDoc = alice.firestore().collection('faq_templates').doc('faq1');

      await assertSucceeds(faqDoc.delete());
    });

    it('denies non-creator from deleting FAQ template', async () => {
      const bob = testEnv.authenticatedContext('bob-uid');
      const faqDoc = bob.firestore().collection('faq_templates').doc('faq1');

      await assertFails(faqDoc.delete());
    });

    it('denies unauthenticated user from deleting FAQ templates', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const faqDoc = unauthed.firestore().collection('faq_templates').doc('faq1');

      await assertFails(faqDoc.delete());
    });
  });

  describe('Default Deny - Undefined Paths', () => {
    it('denies authenticated user from reading undefined collection', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const undefinedDoc = alice.firestore().collection('undefined-collection').doc('test');

      await assertFails(undefinedDoc.get());
    });

    it('denies authenticated user from writing to undefined collection', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const undefinedDoc = alice.firestore().collection('undefined-collection').doc('test');

      await assertFails(undefinedDoc.set({ data: 'test' }));
    });

    it('denies unauthenticated user from reading undefined collection', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const undefinedDoc = unauthed.firestore().collection('undefined-collection').doc('test');

      await assertFails(undefinedDoc.get());
    });

    it('denies unauthenticated user from writing to undefined collection', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const undefinedDoc = unauthed.firestore().collection('undefined-collection').doc('test');

      await assertFails(undefinedDoc.set({ data: 'test' }));
    });
  });
});
