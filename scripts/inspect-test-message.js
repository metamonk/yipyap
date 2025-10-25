/**
 * Inspect our test message
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';
const MESSAGE_ID = 'xheKkGszNnJa4jpal7ol';

async function inspectMessage() {
  const messageDoc = await db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .doc(MESSAGE_ID)
    .get();

  if (!messageDoc.exists) {
    console.log('Message not found - may have been deleted');
    process.exit(1);
  }

  const message = messageDoc.data();
  console.log('\n📬 Test Message:\n');
  console.log(JSON.stringify(message, null, 2));

  console.log('\n' + '='.repeat(60));

  if (message.metadata?.autoResponseId) {
    console.log('\n✅ AUTO-RESPONSE WAS SENT!');
    console.log(`ID: ${message.metadata.autoResponseId}`);
  } else if (message.metadata?.isFAQ === true) {
    console.log('\n⚠️  FAQ detected but NO auto-response');
    console.log(`Confidence: ${(message.metadata.faqMatchConfidence * 100).toFixed(1)}%`);
    console.log(`Template: ${message.metadata.faqTemplateId}`);
  } else {
    console.log('\n❌ No FAQ detection');
  }

  console.log();

  process.exit(0);
}

inspectMessage();
