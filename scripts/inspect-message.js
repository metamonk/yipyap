/**
 * Inspect a specific message
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';
const MESSAGE_ID = 'zK3g4iaxHfKN0ntTbZJr';

async function inspectMessage() {
  const messageDoc = await db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .doc(MESSAGE_ID)
    .get();

  if (!messageDoc.exists) {
    console.log('Message not found');
    process.exit(1);
  }

  const message = messageDoc.data();
  console.log('\n📬 Message Data:\n');
  console.log(JSON.stringify(message, null, 2));
  console.log('\n');

  process.exit(0);
}

inspectMessage();
