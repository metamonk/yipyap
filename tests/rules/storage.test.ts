/**
 * Firebase Storage Security Rules Unit Tests
 *
 * Tests validate that Storage security rules correctly enforce:
 * 1. Users can only upload/update/delete their own profile photo
 * 2. Any authenticated user can read profile photos
 * 3. Unauthenticated requests are denied
 *
 * @requires Firebase Emulator running on port 9199
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

describe('Firebase Storage Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Initialize test environment with storage security rules
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-yipyap-test',
      storage: {
        rules: readFileSync(resolve(__dirname, '../../firebase/storage.rules'), 'utf8'),
        host: 'localhost',
        port: 9199,
      },
    });
  });

  afterAll(async () => {
    // Clean up test environment
    await testEnv.cleanup();
  });

  afterEach(async () => {
    // Clear all storage between tests
    await testEnv.clearStorage();
  });

  describe('Profile Photos - Read Access', () => {
    it('allows authenticated user to read any profile photo', async () => {
      // Create Alice's profile photo using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' });
      });

      // Bob (authenticated) should be able to read Alice's photo
      const bob = testEnv.authenticatedContext('bob-uid');
      const storage = bob.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(ref.getDownloadURL());
    });

    it('allows authenticated user to read their own profile photo', async () => {
      // Create Alice's profile photo using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(ref.getDownloadURL());
    });

    it('denies unauthenticated user from reading profile photos', async () => {
      // Create Alice's profile photo using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' });
      });

      const unauthed = testEnv.unauthenticatedContext();
      const storage = unauthed.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertFails(ref.getDownloadURL());
    });
  });

  describe('Profile Photos - Write Access (Upload)', () => {
    it('allows authenticated user to upload their own profile photo', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(
        ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' }).then()
      );
    });

    it('denies authenticated user from uploading to another user profile photo path', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/bob-uid/profile.jpg');

      await assertFails(
        ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' }).then()
      );
    });

    it('denies unauthenticated user from uploading profile photos', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const storage = unauthed.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertFails(
        ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' }).then()
      );
    });
  });

  describe('Profile Photos - Write Access (Update)', () => {
    it('allows authenticated user to update their own profile photo', async () => {
      // Create Alice's profile photo first
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('old-image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      // Update with new image data
      await assertSucceeds(
        ref.put(Buffer.from('new-image-data'), { contentType: 'image/jpeg' }).then()
      );
    });

    it('denies authenticated user from updating another user profile photo', async () => {
      // Create Bob's profile photo
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/bob-uid/profile.jpg');
        await ref.put(Buffer.from('bob-image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/bob-uid/profile.jpg');

      await assertFails(
        ref.put(Buffer.from('hacked-image-data'), { contentType: 'image/jpeg' }).then()
      );
    });
  });

  describe('Profile Photos - Write Access (Delete)', () => {
    it('allows authenticated user to delete their own profile photo', async () => {
      // Create Alice's profile photo
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(ref.delete());
    });

    it('denies authenticated user from deleting another user profile photo', async () => {
      // Create Bob's profile photo
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/bob-uid/profile.jpg');
        await ref.put(Buffer.from('bob-image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/bob-uid/profile.jpg');

      await assertFails(ref.delete());
    });

    it('denies unauthenticated user from deleting profile photos', async () => {
      // Create Alice's profile photo
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('image-data'), { contentType: 'image/jpeg' });
      });

      const unauthed = testEnv.unauthenticatedContext();
      const storage = unauthed.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertFails(ref.delete());
    });
  });

  describe('Profile Photos - File Validation', () => {
    it('allows upload of image file with valid size (under 5MB)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      // Create a buffer under 5MB with image content type
      const validImageData = Buffer.alloc(1024 * 1024); // 1MB
      await assertSucceeds(ref.put(validImageData, { contentType: 'image/jpeg' }).then());
    });

    it('denies upload of file exceeding 5MB size limit', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      // Create a buffer larger than 5MB
      const largeImageData = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await assertFails(ref.put(largeImageData, { contentType: 'image/jpeg' }).then());
    });

    it('allows upload with image/jpeg content type', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(
        ref.put(Buffer.from('image-data'), { contentType: 'image/jpeg' }).then()
      );
    });

    it('allows upload with image/png content type', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(ref.put(Buffer.from('image-data'), { contentType: 'image/png' }).then());
    });

    it('allows upload with image/gif content type', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertSucceeds(ref.put(Buffer.from('image-data'), { contentType: 'image/gif' }).then());
    });

    it('denies upload with non-image content type (text/plain)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertFails(ref.put(Buffer.from('text-data'), { contentType: 'text/plain' }).then());
    });

    it('denies upload with non-image content type (application/pdf)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertFails(
        ref.put(Buffer.from('pdf-data'), { contentType: 'application/pdf' }).then()
      );
    });

    it('denies upload with non-image content type (video/mp4)', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      await assertFails(ref.put(Buffer.from('video-data'), { contentType: 'video/mp4' }).then());
    });

    it('denies upload without content type metadata', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      // Upload without contentType metadata
      await assertFails(ref.put(Buffer.from('image-data')).then());
    });

    it('allows update of existing photo with valid image type and size', async () => {
      // Create Alice's profile photo first
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('old-image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      const validImageData = Buffer.alloc(2 * 1024 * 1024); // 2MB
      await assertSucceeds(ref.put(validImageData, { contentType: 'image/png' }).then());
    });

    it('denies update with file exceeding size limit', async () => {
      // Create Alice's profile photo first
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('users/alice-uid/profile.jpg');
        await ref.put(Buffer.from('old-image-data'), { contentType: 'image/jpeg' });
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('users/alice-uid/profile.jpg');

      const largeImageData = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await assertFails(ref.put(largeImageData, { contentType: 'image/jpeg' }).then());
    });
  });

  describe('Default Deny - Undefined Paths', () => {
    it('denies authenticated user from reading undefined storage path', async () => {
      // Create file at undefined path using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('undefined-path/test.jpg');
        await ref.put(Buffer.from('test-data'));
      });

      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('undefined-path/test.jpg');

      await assertFails(ref.getDownloadURL());
    });

    it('denies authenticated user from writing to undefined storage path', async () => {
      const alice = testEnv.authenticatedContext('alice-uid');
      const storage = alice.storage();
      const ref = storage.ref('undefined-path/test.jpg');

      await assertFails(ref.put(Buffer.from('test-data')).then());
    });

    it('denies unauthenticated user from reading undefined storage path', async () => {
      // Create file at undefined path using admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const storage = context.storage();
        const ref = storage.ref('undefined-path/test.jpg');
        await ref.put(Buffer.from('test-data'));
      });

      const unauthed = testEnv.unauthenticatedContext();
      const storage = unauthed.storage();
      const ref = storage.ref('undefined-path/test.jpg');

      await assertFails(ref.getDownloadURL());
    });

    it('denies unauthenticated user from writing to undefined storage path', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      const storage = unauthed.storage();
      const ref = storage.ref('undefined-path/test.jpg');

      await assertFails(ref.put(Buffer.from('test-data')).then());
    });
  });
});
