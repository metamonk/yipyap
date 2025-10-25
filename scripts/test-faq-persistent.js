/**
 * Test FAQ detection with specific user - keeps message for inspection
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

const FAQ_USER_ID = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';
const CONVERSATION_ID = '51Em8S5LenHVeVv8fRD3';

async function testWithFAQUser() {
  console.log('🧪 FAQ Detection Test - Persistent Message\n');
  console.log('='.repeat(60));

  try {
    // Get FAQ templates
    const faqTemplates = await db.collection('faq_templates')
      .where('creatorId', '==', FAQ_USER_ID)
      .where('isActive', '==', true)
      .get();

    const testFAQ = faqTemplates.docs[0].data();
    const testQuestion = testFAQ.question;

    console.log(`\n📝 Creating test message: "${testQuestion}"`);

    const testMessage = {
      text: testQuestion,
      senderId: 'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',  // FROM other user
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'delivered',
      readBy: [],
      metadata: {}
    };

    const messageRef = await db.collection('conversations')
      .doc(CONVERSATION_ID)
      .collection('messages')
      .add(testMessage);

    const messageId = messageRef.id;
    console.log(`✅ Message created: ${messageId}`);

    // Wait and watch for metadata update
    console.log('\n⏱️  Watching for FAQ detection and auto-response (30s timeout)...\n');

    const startTime = Date.now();
    let detected = false;
    let autoResponseSent = false;

    while ((Date.now() - startTime) < 30000) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messageDoc = await messageRef.get();
      const messageData = messageDoc.data();
      const metadata = messageData.metadata || {};

      // Check for FAQ detection
      if (!detected && metadata.faqMatchConfidence !== undefined) {
        detected = true;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ FAQ detection completed in ${elapsed}s!`);
        console.log(`   Confidence: ${(metadata.faqMatchConfidence * 100).toFixed(1)}%`);
        console.log(`   Is FAQ: ${metadata.isFAQ ? 'YES' : 'NO'}`);
        console.log(`   Template ID: ${metadata.faqTemplateId}`);
      }

      // Check for auto-response
      if (detected && !autoResponseSent && metadata.autoResponseId) {
        autoResponseSent = true;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Auto-response sent in ${elapsed}s!`);
        console.log(`   Auto-response ID: ${metadata.autoResponseId}`);

        // Fetch the auto-response message
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

        break;
      }

      process.stdout.write('.');
    }

    console.log('\n\n' + '='.repeat(60));
    console.log(`\nMessage ID: ${messageId}`);
    console.log('Message kept for inspection - delete manually if needed');
    console.log('='.repeat(60) + '\n');

    process.exit(autoResponseSent ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testWithFAQUser();
