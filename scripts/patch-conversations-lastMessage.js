/**
 * Patch existing test conversations to add proper lastMessage object structure
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
  console.log('🔧 Patching conversations with proper lastMessage structure...\n');

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
    const updates = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fanId = data.participantIds.find(id => id !== userId);

      console.log(`Patching conversation: ${doc.id}`);

      // Get the latest message from this conversation
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(doc.id)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      let lastMessageText = 'No messages yet';
      let lastMessageSenderId = fanId;

      if (!messagesSnapshot.empty) {
        const lastMsg = messagesSnapshot.docs[0].data();
        lastMessageText = lastMsg.text || 'No text';
        lastMessageSenderId = lastMsg.senderId || fanId;
        console.log(`  Found last message: "${lastMessageText.substring(0, 50)}..."`);
      }

      updates.push(
        doc.ref.update({
          type: 'direct',
          lastMessage: {
            text: lastMessageText,
            senderId: lastMessageSenderId,
            timestamp: data.lastMessageTimestamp || admin.firestore.FieldValue.serverTimestamp(),
          },
          lastMessageTimestamp: data.lastMessageTimestamp || admin.firestore.FieldValue.serverTimestamp(),
        })
      );
    }

    await Promise.all(updates);

    console.log(`\n✅ Successfully patched ${snapshot.size} conversations!`);
    console.log('\nUpdated structure:');
    console.log('  - Added type: "direct"');
    console.log('  - Added lastMessage: { text, senderId, timestamp }');
    console.log('  - Preserved lastMessageTimestamp for sorting');
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
