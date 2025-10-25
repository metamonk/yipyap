/**
 * Clean up test messages
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';
const TEST_MESSAGE_IDS = ['zK3g4iaxHfKN0ntTbZJr', 'qakBHq0UuBqBcGJLg9lB'];

async function cleanup() {
  console.log('🧹 Cleaning up test messages...\n');

  for (const messageId of TEST_MESSAGE_IDS) {
    try {
      await db.collection('conversations')
        .doc(CONVERSATION_ID)
        .collection('messages')
        .doc(messageId)
        .delete();
      console.log(`✅ Deleted: ${messageId}`);
    } catch (error) {
      console.log(`⚠️  Could not delete ${messageId}:`, error.message);
    }
  }

  console.log('\n✅ Cleanup complete!\n');
  process.exit(0);
}

cleanup();
