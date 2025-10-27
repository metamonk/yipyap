/**
 * Check metadata of test messages to verify relationshipScore is set
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

async function checkMessages() {
  console.log('🔍 Checking message metadata...\n');

  try {
    // Get test conversations
    const conversationsSnap = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userId)
      .limit(6)
      .get();

    console.log(`Found ${conversationsSnap.size} conversations\n`);

    for (const convDoc of conversationsSnap.docs) {
      const convData = convDoc.data();
      console.log(`\n=== Conversation: ${convDoc.id} ===`);

      // Get messages
      const messagesSnap = await db
        .collection('conversations')
        .doc(convDoc.id)
        .collection('messages')
        .where('senderId', '!=', userId)
        .limit(3)
        .get();

      console.log(`Messages: ${messagesSnap.size}`);

      messagesSnap.docs.forEach((msgDoc, i) => {
        const msgData = msgDoc.data();
        console.log(`\n  Message ${i + 1}: ${msgDoc.id}`);
        console.log(`    Text: ${msgData.text?.substring(0, 60)}...`);
        console.log(`    SenderId: ${msgData.senderId}`);
        console.log(`    Timestamp: ${msgData.timestamp?.toDate?.()}`);
        console.log(`    Metadata:`);
        console.log(`      relationshipScore: ${msgData.metadata?.relationshipScore}`);
        console.log(`      relationshipPriority: ${msgData.metadata?.relationshipPriority}`);
        console.log(`      category: ${msgData.metadata?.category}`);
        console.log(`      sentimentScore: ${msgData.metadata?.sentimentScore}`);
        console.log(`      processed: ${msgData.metadata?.processed}`);
        console.log(`      needsReview: ${msgData.metadata?.needsReview}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking messages:', error);
    throw error;
  }
}

checkMessages()
  .then(() => {
    console.log('\n\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
