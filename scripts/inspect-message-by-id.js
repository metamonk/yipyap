/**
 * Inspect a specific message by conversation and message ID
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

// From logs: 2025-10-25T14:03:29.001739727Z
const CONVERSATION_ID = 'ahxtQyHuQ13gN7lz0uSF';
const MESSAGE_ID = 'msg_ahxtQyHuQ13gN7lz0uSF_145_mwhpc92dw';

async function inspectMessage() {
  console.log(`\n📬 Inspecting Message\n`);
  console.log(`Conversation: ${CONVERSATION_ID}`);
  console.log(`Message: ${MESSAGE_ID}\n`);

  const messageDoc = await db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .doc(MESSAGE_ID)
    .get();

  if (!messageDoc.exists) {
    console.log('❌ Message not found');
    process.exit(1);
  }

  const message = messageDoc.data();
  console.log('Message Data:');
  console.log(JSON.stringify(message, null, 2));
  console.log();

  // Check for auto-response
  if (message.metadata?.autoResponseId) {
    console.log(`\n✅ Auto-response was sent!`);
    console.log(`Auto-response ID: ${message.metadata.autoResponseId}`);

    const autoResponseDoc = await db.collection('conversations')
      .doc(CONVERSATION_ID)
      .collection('messages')
      .doc(message.metadata.autoResponseId)
      .get();

    if (autoResponseDoc.exists) {
      console.log('\nAuto-response message:');
      console.log(JSON.stringify(autoResponseDoc.data(), null, 2));
    }
  } else {
    console.log('\n⚠️  No auto-response');
  }

  process.exit(0);
}

inspectMessage();
