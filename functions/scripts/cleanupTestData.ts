/**
 * Cleanup Test Data (Story 6.4)
 *
 * Removes all test conversations, messages, undo records, and rate limits.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/cleanupTestData.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json'))
});

const db = admin.firestore();

async function cleanup() {
  const userId = 'test-creator-123';

  console.log('🗑️  Cleaning up test data...\n');

  // Delete conversations and their messages
  const convs = await db.collection('conversations')
    .where('participantIds', 'array-contains', userId)
    .get();

  for (const conv of convs.docs) {
    // Delete messages subcollection
    const msgs = await conv.ref.collection('messages').get();
    for (const msg of msgs.docs) {
      await msg.ref.delete();
    }
    await conv.ref.delete();
  }
  console.log(`✅ Deleted ${convs.size} conversations (+ ${convs.docs.reduce((sum, doc) => sum + doc.data().messageCount || 0, 0)} messages)`);

  // Delete undo records
  const undos = await db.collection('undo_archive')
    .where('userId', '==', userId)
    .get();

  for (const undo of undos.docs) {
    await undo.ref.delete();
  }
  console.log(`✅ Deleted ${undos.size} undo records`);

  // Delete rate limits
  const limits = await db.collection('rate_limits')
    .doc('boundary_messages')
    .collection('limits')
    .get();

  for (const limit of limits.docs) {
    await limit.ref.delete();
  }
  console.log(`✅ Deleted ${limits.size} rate limits`);

  // Optionally delete test user
  console.log('\nℹ️  Test user (test-creator-123) was NOT deleted.');
  console.log('   To delete user, run: firebase auth:delete test-creator-123');

  console.log('\n✅ Cleanup complete!');
}

cleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
