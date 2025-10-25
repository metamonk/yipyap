/**
 * Test auto-response by directly simulating the onUpdate trigger
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';
const FAQ_USER_ID = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

async function testAutoResponse() {
  console.log('🧪 Testing auto-response trigger logic\n');

  // Create a test message
  const testMessage = {
    text: 'What is your favorite food?',
    senderId: 'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',
    timestamp: admin.firestore.Timestamp.now(),
    status: 'delivered',
    readBy: [],
    metadata: {}
  };

  console.log('1️⃣  Creating message WITHOUT FAQ metadata...');
  const messageRef = await db.collection('conversations')
    .doc(CONVERSATION_ID)
    .collection('messages')
    .add(testMessage);

  const messageId = messageRef.id;
  console.log(`✅ Message created: ${messageId}`);

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Now UPDATE the message to add FAQ metadata (simulating what the detection function does)
  console.log('\n2️⃣  Updating message to add FAQ metadata (simulating detection)...');
  await messageRef.update({
    'metadata.isFAQ': true,
    'metadata.faqTemplateId': '2crsIFhWvLHOwy3x7VmE',
    'metadata.faqMatchConfidence': 1.0
  });

  console.log('✅ FAQ metadata added');
  console.log('   This should trigger onFAQDetected onUpdate function...');

  // Wait for auto-response
  console.log('\n3️⃣  Waiting 10s for auto-response...\n');

  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const messageDoc = await messageRef.get();
    const metadata = messageDoc.data().metadata;

    if (metadata.autoResponseId) {
      console.log(`\n✅ SUCCESS! Auto-response triggered in ${i + 1}s`);
      console.log(`   Auto-response ID: ${metadata.autoResponseId}`);

      // Fetch the auto-response
      const autoResponseDoc = await db.collection('conversations')
        .doc(CONVERSATION_ID)
        .collection('messages')
        .doc(metadata.autoResponseId)
        .get();

      if (autoResponseDoc.exists) {
        const autoResponse = autoResponseDoc.data();
        console.log(`   Sender: ${autoResponse.senderId}`);
        console.log(`   Text: "${autoResponse.text}"`);
      }

      // Cleanup
      console.log('\n4️⃣  Cleaning up...');
      await messageRef.delete();
      if (autoResponseDoc.exists) {
        await autoResponseDoc.ref.delete();
      }
      console.log('✅ Cleanup complete\n');

      process.exit(0);
    }

    process.stdout.write('.');
  }

  console.log('\n\n❌ FAILED: Auto-response did not trigger');
  console.log('   Message metadata:', (await messageRef.get()).data().metadata);

  // Cleanup
  await messageRef.delete();
  process.exit(1);
}

testAutoResponse();
