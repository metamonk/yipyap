const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkConversations() {
  // Check conversations for zeno
  const convs = await db
    .collection('conversations')
    .where('participantIds', 'array-contains', 'XoBenqsIt7bRp9ZYsftif0ZQc9o1')
    .get();

  console.log(`Found ${convs.size} conversations for zeno\n`);

  for (const conv of convs.docs) {
    const data = conv.data();
    const lastMsgDate = data.lastMessageTimestamp.toDate();
    const hoursSinceLastMsg = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);

    console.log(`Conversation ${conv.id}:`);
    console.log(`  Type: ${data.type}`);
    console.log(`  Participants: ${data.participantIds.join(', ')}`);
    console.log(`  Last message: ${lastMsgDate.toISOString()}`);
    console.log(`  Hours since last msg: ${hoursSinceLastMsg.toFixed(2)}`);
    console.log(`  Group name: ${data.groupName || 'Direct message'}`);

    // Check messages in this conversation
    const msgs = await db
      .collection('conversations')
      .doc(conv.id)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();

    console.log(`  Total messages in subcollection: ${msgs.size}`);

    if (msgs.size > 0) {
      msgs.docs.forEach((msgDoc, i) => {
        const msg = msgDoc.data();
        const msgDate = msg.timestamp.toDate();
        const hoursAgo = (Date.now() - msgDate.getTime()) / (1000 * 60 * 60);
        console.log(`    Message ${i+1}:`);
        console.log(`      Sender: ${msg.senderId}`);
        console.log(`      Time: ${msgDate.toISOString()} (${hoursAgo.toFixed(2)}h ago)`);
        console.log(`      Text: ${msg.text.substring(0, 50)}...`);
        console.log(`      AI Processed: ${msg.metadata?.aiProcessed || false}`);
      });
    }
    console.log('');
  }
}

checkConversations().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
