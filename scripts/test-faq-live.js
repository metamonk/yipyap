/**
 * Live test for FAQ detection
 *
 * Run with: GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json node scripts/test-faq-live.js
 *
 * This creates a test message and watches for FAQ detection to complete
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

async function testLive() {
  console.log('🧪 Live FAQ Detection Test\n');
  console.log('='.repeat(60));

  try {
    // Find a conversation to test with
    console.log('\n1️⃣  Finding test conversation...');
    const conversationsSnapshot = await db.collection('conversations')
      .limit(1)
      .get();

    if (conversationsSnapshot.empty) {
      console.log('❌ No conversations found. Create a conversation in the app first.');
      process.exit(1);
    }

    const conversationDoc = conversationsSnapshot.docs[0];
    const conversation = conversationDoc.data();
    const conversationId = conversationDoc.id;

    console.log(`✅ Using conversation: ${conversationId}`);
    console.log(`   Type: ${conversation.type}`);
    console.log(`   Participants: ${conversation.participantIds.join(', ')}`);

    // Create a test message
    console.log('\n2️⃣  Creating test message: "What is your favorite food?"');

    const testMessage = {
      text: 'What is your favorite food?',
      senderId: conversation.participantIds[0],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'delivered',
      readBy: [],
      metadata: {}
    };

    const messageRef = await db.collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .add(testMessage);

    const messageId = messageRef.id;
    console.log(`✅ Message created: ${messageId}`);

    // Wait and watch for metadata update
    console.log('\n3️⃣  Watching for FAQ detection (30s timeout)...\n');

    const startTime = Date.now();
    let detected = false;

    while (!detected && (Date.now() - startTime) < 30000) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messageDoc = await messageRef.get();
      const messageData = messageDoc.data();

      if (messageData.metadata?.faqMatchConfidence !== undefined) {
        detected = true;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n✅ FAQ detection completed in ${elapsed}s!`);
        console.log('\n📊 Results:');
        console.log(`   Confidence: ${(messageData.metadata.faqMatchConfidence * 100).toFixed(1)}%`);
        console.log(`   Is FAQ: ${messageData.metadata.isFAQ ? 'YES' : 'NO'}`);

        if (messageData.metadata.faqMatchConfidence >= 0.85) {
          console.log(`   ✅ HIGH CONFIDENCE - Should auto-send`);
          if (messageData.metadata.faqTemplateId) {
            console.log(`   Template ID: ${messageData.metadata.faqTemplateId}`);
          }
        } else if (messageData.metadata.faqMatchConfidence >= 0.70) {
          console.log(`   💡 MEDIUM CONFIDENCE - Should show suggestion`);
          if (messageData.metadata.suggestedFAQ) {
            console.log(`   Question: "${messageData.metadata.suggestedFAQ.question}"`);
          }
        } else {
          console.log(`   ℹ️  LOW CONFIDENCE - No action`);
        }
      } else {
        process.stdout.write('.');
      }
    }

    if (!detected) {
      console.log('\n\n⏱️  Timeout: FAQ detection did not complete in 30s');
      console.log('\n❌ Possible issues:');
      console.log('   1. Cloud Function "onMessageCreatedDetectFAQ" not triggering');
      console.log('   2. Edge Function /api/detect-faq is down or slow');
      console.log('   3. No FAQ templates exist for the creator');
      console.log('\nCheck logs:');
      console.log('   firebase functions:log --only onMessageCreatedDetectFAQ');
    }

    // Clean up test message
    console.log('\n4️⃣  Cleaning up test message...');
    await messageRef.delete();
    console.log('✅ Test message deleted');

    console.log('\n' + '='.repeat(60));
    console.log(detected ? '\n✅ Test PASSED!\n' : '\n❌ Test FAILED!\n');

    process.exit(detected ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testLive();
