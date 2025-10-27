/**
 * Check the "real" (non-test) conversations for messages
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

// Real conversation IDs
const realConvIds = [
  'QKw7CZMc7aP8dLOM0jD0dUTQLQL2_XoBenqsIt7bRp9ZYsftif0ZQc9o1',
  'XoBenqsIt7bRp9ZYsftif0ZQc9o1_jvExoDDTXsZHly4SOEfKmHZdqE42',
  'aT4y1zSPEROilrpUSnS6',
  'bC3XKb5tYExBR8yEn3LQ',
];

async function checkOtherConversations() {
  console.log('🔍 Checking non-test conversations...\n');

  const twelveHoursAgo = new admin.firestore.Timestamp(
    admin.firestore.Timestamp.now().seconds - 12 * 60 * 60,
    0
  );

  const oneHourAgo = new admin.firestore.Timestamp(
    admin.firestore.Timestamp.now().seconds - 60 * 60,
    0
  );

  try {
    let totalMessages = 0;
    const conversationIdSet = new Set();

    for (const convId of realConvIds) {
      const convRef = db.collection('conversations').doc(convId);
      const convSnap = await convRef.get();

      if (!convSnap.exists) {
        console.log(`❌ ${convId}: DOES NOT EXIST`);
        continue;
      }

      const convData = convSnap.data();
      const lastMsgTimestamp = convData.lastMessageTimestamp;
      const isRecent = lastMsgTimestamp && lastMsgTimestamp.seconds > oneHourAgo.seconds;

      console.log(`\n=== ${convId} ===`);
      console.log(`Last message timestamp: ${lastMsgTimestamp?.toDate?.() || 'N/A'}`);
      console.log(`Is recent (< 1 hour): ${isRecent}`);
      console.log(`Would be skipped by workflow: ${isRecent}`);

      if (isRecent) {
        console.log('SKIPPING (recent activity)');
        continue;
      }

      // Fetch messages from last 12 hours (same as workflow)
      const messagesSnap = await convRef
        .collection('messages')
        .where('timestamp', '>=', twelveHoursAgo)
        .orderBy('timestamp', 'desc')
        .get();

      console.log(`Total messages (12h): ${messagesSnap.size}`);

      let fromOthers = 0;

      messagesSnap.docs.forEach((msgDoc) => {
        const msgData = msgDoc.data();

        if (msgData.senderId !== userId) {
          fromOthers++;
          totalMessages++;
          conversationIdSet.add(msgData.conversationId || 'MISSING');

          console.log(`  Message ${msgDoc.id}:`);
          console.log(`    ConversationID: ${msgData.conversationId || 'MISSING'}`);
          console.log(`    SenderID: ${msgData.senderId}`);
          console.log(`    Timestamp: ${msgData.timestamp?.toDate?.()}`);
          console.log(`    Processed: ${msgData.metadata?.aiProcessed}`);
        }
      });

      console.log(`Messages from others: ${fromOthers}`);
    }

    console.log('\n\n=== SUMMARY ===');
    console.log(`Total messages from others: ${totalMessages}`);
    console.log(`Unique conversation IDs in messages:`);
    conversationIdSet.forEach((id) => console.log(`  - ${id}`));
    console.log(`Total unique: ${conversationIdSet.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkOtherConversations()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
