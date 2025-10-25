/**
 * Manually trigger auto-response by updating a message
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';
const MESSAGE_ID = 'zK3g4iaxHfKN0ntTbZJr';

async function triggerAutoResponse() {
  console.log('🔧 Manually triggering auto-response...\n');

  // Get current message
  const messageRef = db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .doc(MESSAGE_ID);

  const messageDoc = await messageRef.get();
  console.log('Current metadata:', messageDoc.data().metadata);

  // Trigger an update by adding a dummy field then removing it
  console.log('\n1. Adding dummy field...');
  await messageRef.update({
    'metadata.triggerTest': true
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('2. Checking for auto-response...');
  const updatedDoc = await messageRef.get();
  const metadata = updatedDoc.data().metadata;

  console.log('Updated metadata:', metadata);

  if (metadata.autoResponseId) {
    console.log(`\n✅ Auto-response triggered! ID: ${metadata.autoResponseId}`);
  } else {
    console.log(`\n⚠️  No auto-response yet`);
  }

  process.exit(0);
}

triggerAutoResponse();
