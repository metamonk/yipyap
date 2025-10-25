/**
 * Cleanup Seed Data Script
 *
 * @remarks
 * Deletes all conversations for the seed users.
 * Run with: npx tsx scripts/cleanupSeedData.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { readFileSync } from 'fs';

// Load service account
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Real users from the app
const USER_IDS = [
  'QKw7CZMc7aP8dLOM0jD0dUTQLQL2', // metamonk
  'XoBenqsIt7bRp9ZYsftif0ZQc9o1', // zeno
  'jvExoDDTXsZHly4SOEfKmHZdqE42', // lily
];

async function cleanupSeedData() {
  try {
    console.log('🗑️  Starting cleanup of seed data...\n');

    // Find all conversations involving these users
    const conversationsSnapshot = await db
      .collection('conversations')
      .where('participantIds', 'array-contains-any', USER_IDS)
      .get();

    console.log(`Found ${conversationsSnapshot.size} conversations to delete\n`);

    if (conversationsSnapshot.empty) {
      console.log('No conversations found. Nothing to clean up.');
      return;
    }

    // Delete each conversation and its messages
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationId = conversationDoc.id;
      const conversationData = conversationDoc.data();

      console.log(`Deleting conversation: ${conversationData.groupName || 'Direct chat'} (${conversationId})`);

      // Delete all messages in the conversation
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();

      console.log(`  - Deleting ${messagesSnapshot.size} messages...`);

      // Delete messages in batches
      const BATCH_SIZE = 500;
      const messageDocs = messagesSnapshot.docs;
      for (let i = 0; i < messageDocs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchDocs = messageDocs.slice(i, i + BATCH_SIZE);

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`    ✓ Deleted messages ${i + 1}-${Math.min(i + BATCH_SIZE, messageDocs.length)}`);
      }

      // Delete the conversation document
      await conversationDoc.ref.delete();
      console.log(`  ✅ Conversation deleted\n`);
    }

    console.log('✅ Cleanup complete!');
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
cleanupSeedData()
  .then(() => {
    console.log('\n👋 Cleanup script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup script failed:', error);
    process.exit(1);
  });
