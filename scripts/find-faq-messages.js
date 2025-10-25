/**
 * Find messages with FAQ text
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';

async function findMessages() {
  console.log('🔍 Searching for FAQ messages...\n');

  const messagesSnapshot = await db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .where('text', '==', 'What is your favorite food?')
    .get();

  console.log(`Found ${messagesSnapshot.size} messages with this text:\n`);

  messagesSnapshot.docs.forEach((doc) => {
    const message = doc.data();
    const timestamp = message.timestamp?.toDate?.() || message.timestamp;

    console.log(`Message ID: ${doc.id}`);
    console.log(`  Time: ${timestamp}`);
    console.log(`  Sender: ${message.senderId}`);
    console.log(`  Metadata:`);
    console.log(`    isFAQ: ${message.metadata?.isFAQ}`);
    console.log(`    confidence: ${message.metadata?.faqMatchConfidence}`);
    console.log(`    templateId: ${message.metadata?.faqTemplateId}`);
    console.log(`    suggestedFAQ: ${message.metadata?.suggestedFAQ ? 'YES' : 'NO'}`);
    if (message.metadata?.suggestedFAQ) {
      console.log(`      confidence: ${message.metadata.suggestedFAQ.confidence}`);
      console.log(`      answer: "${message.metadata.suggestedFAQ.answer?.substring(0, 60)}..."`);
    }
    console.log();
  });

  process.exit(0);
}

findMessages();
