/**
 * Count messages in each test conversation
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

// Test conversation IDs
const testConvIds = [
  'conv_1761499215052_gl7jve1ut',
  'conv_1761499215677_ph7zwlqqf',
  'conv_1761499216049_yj2t8m9kw',
  'conv_1761499216436_80u1efbdv',
  'conv_1761499216823_zqtga9knp',
  'conv_1761499217180_kccz0a4sy',
];

async function countMessagesPerConversation() {
  console.log('🔍 Counting messages per conversation...\n');

  const twelveHoursAgo = new admin.firestore.Timestamp(
    admin.firestore.Timestamp.now().seconds - 12 * 60 * 60,
    0
  );

  try {
    let totalMessages = 0;
    const conversationIdSet = new Set();

    for (const convId of testConvIds) {
      const convRef = db.collection('conversations').doc(convId);

      // Fetch messages from last 12 hours (same as workflow)
      const messagesSnap = await convRef
        .collection('messages')
        .where('timestamp', '>=', twelveHoursAgo)
        .orderBy('timestamp', 'desc')
        .get();

      console.log(`${convId}:`);
      console.log(`  Total messages: ${messagesSnap.size}`);

      let fromUser = 0;
      let fromOthers = 0;

      messagesSnap.docs.forEach((msgDoc) => {
        const msgData = msgDoc.data();

        if (msgData.senderId === userId) {
          fromUser++;
        } else {
          fromOthers++;
          totalMessages++;
          conversationIdSet.add(msgData.conversationId || 'MISSING');
        }

        console.log(`    Message ${msgDoc.id}:`);
        console.log(`      ConversationID: ${msgData.conversationId || 'MISSING'}`);
        console.log(`      SenderID: ${msgData.senderId}`);
        console.log(`      From user: ${msgData.senderId === userId}`);
      });

      console.log(`  From user: ${fromUser}`);
      console.log(`  From others: ${fromOthers}`);
      console.log('');
    }

    console.log('=== SUMMARY ===');
    console.log(`Total messages from others: ${totalMessages}`);
    console.log(`Unique conversation IDs in messages:`);
    conversationIdSet.forEach((id) => console.log(`  - ${id}`));
    console.log(`Total unique: ${conversationIdSet.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

countMessagesPerConversation()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
