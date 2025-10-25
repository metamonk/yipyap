/**
 * Check recent messages in a conversation
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';

async function checkMessages() {
  console.log(`\n📬 Checking messages in conversation: ${CONVERSATION_ID}\n`);

  const messagesSnapshot = await db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  console.log(`Found ${messagesSnapshot.size} recent messages:\n`);

  messagesSnapshot.docs.forEach((doc, idx) => {
    const message = doc.data();
    console.log(`${idx + 1}. Message ID: ${doc.id}`);
    console.log(`   Sender: ${message.senderId}`);
    console.log(`   Text: "${message.text?.substring(0, 60)}${message.text?.length > 60 ? '...' : ''}"`);
    console.log(`   Metadata:`);
    console.log(`     isFAQ: ${message.metadata?.isFAQ}`);
    console.log(`     confidence: ${message.metadata?.faqMatchConfidence}`);
    console.log(`     templateId: ${message.metadata?.faqTemplateId}`);
    console.log(`     autoResponseId: ${message.metadata?.autoResponseId}`);
    console.log(`     autoResponseSent: ${message.metadata?.autoResponseSent}`);
    console.log();
  });

  process.exit(0);
}

checkMessages();
