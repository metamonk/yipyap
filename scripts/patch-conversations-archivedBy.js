/**
 * Patch existing test conversations to add missing archivedBy and mutedBy fields
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

async function patchConversations() {
  console.log('🔧 Patching conversations with missing archivedBy and mutedBy fields...\n');

  try {
    // Find all conversations for this user
    const snapshot = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userId)
      .get();

    console.log(`Found ${snapshot.size} conversations to update\n`);

    if (snapshot.empty) {
      console.log('No conversations found to patch');
      return;
    }

    // Update each conversation
    const updates = snapshot.docs.map((doc, index) => {
      const data = doc.data();
      const fanId = data.participantIds.find(id => id !== userId);

      console.log(`${index + 1}. Patching conversation: ${doc.id}`);

      return doc.ref.update({
        archivedBy: {},
        mutedBy: {},
        // Keep existing fields, just ensure they're present
        deletedBy: data.deletedBy || {},
        unreadCount: data.unreadCount || {
          [userId]: 1,
          [fanId]: 0,
        },
      });
    });

    await Promise.all(updates);

    console.log(`\n✅ Successfully patched ${snapshot.size} conversations!`);
    console.log('\nAdded fields:');
    console.log('  - archivedBy: {}');
    console.log('  - mutedBy: {}');
  } catch (error) {
    console.error('❌ Error patching conversations:', error);
    throw error;
  }
}

patchConversations()
  .then(() => {
    console.log('\n✅ Patch complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Patch failed:', error);
    process.exit(1);
  });
