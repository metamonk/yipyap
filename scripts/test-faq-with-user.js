/**
 * Test FAQ detection with specific user
 *
 * Run with: GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json node scripts/test-faq-with-user.js
 *
 * Sends a test message TO the user with FAQs enabled and watches for detection
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

// User with FAQ templates
const FAQ_USER_ID = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

async function testWithFAQUser() {
  console.log('🧪 FAQ Detection Test - Specific User\n');
  console.log('='.repeat(60));
  console.log(`\nFAQ User: ${FAQ_USER_ID}`);

  try {
    // Find or create conversation with FAQ user
    console.log('\n1️⃣  Finding conversation with FAQ user...');

    const conversationsSnapshot = await db.collection('conversations')
      .where('participantIds', 'array-contains', FAQ_USER_ID)
      .where('type', '==', 'direct')
      .limit(1)
      .get();

    let conversationId;
    let otherUserId;

    if (!conversationsSnapshot.empty) {
      const convDoc = conversationsSnapshot.docs[0];
      const conversation = convDoc.data();
      conversationId = convDoc.id;

      // Get the OTHER user (not the FAQ user)
      otherUserId = conversation.participantIds.find(id => id !== FAQ_USER_ID);

      console.log(`✅ Found existing conversation: ${conversationId}`);
      console.log(`   Participants: ${conversation.participantIds.join(', ')}`);
    } else {
      console.log('⚠️  No existing conversation found.');
      console.log('   Create a conversation in the app first, then run this test.');
      process.exit(1);
    }

    // Show FAQ user's templates
    console.log('\n2️⃣  Checking FAQ templates...');
    const faqTemplates = await db.collection('faq_templates')
      .where('creatorId', '==', FAQ_USER_ID)
      .where('isActive', '==', true)
      .get();

    console.log(`✅ Found ${faqTemplates.size} active FAQ templates:`);
    faqTemplates.docs.forEach((doc, idx) => {
      const faq = doc.data();
      console.log(`   ${idx + 1}. "${faq.question}"`);
    });

    if (faqTemplates.size === 0) {
      console.log('\n❌ No FAQ templates found! Create some in the app first.');
      process.exit(1);
    }

    // Use first FAQ template for test
    const testFAQ = faqTemplates.docs[0].data();
    const testQuestion = testFAQ.question;

    // Create test message FROM other user TO FAQ user
    console.log(`\n3️⃣  Creating test message: "${testQuestion}"`);
    console.log(`   From: ${otherUserId}`);
    console.log(`   To: ${FAQ_USER_ID}`);

    const testMessage = {
      text: testQuestion,
      senderId: otherUserId,  // FROM other user
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
    console.log('\n4️⃣  Watching for FAQ detection (20s timeout)...\n');

    const startTime = Date.now();
    let detected = false;
    let lastMetadata = null;

    while (!detected && (Date.now() - startTime) < 20000) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messageDoc = await messageRef.get();
      const messageData = messageDoc.data();
      const metadata = messageData.metadata || {};

      // Check if metadata changed
      if (JSON.stringify(metadata) !== JSON.stringify(lastMetadata)) {
        lastMetadata = metadata;

        if (metadata.faqMatchConfidence !== undefined) {
          detected = true;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

          console.log(`\n✅ FAQ detection completed in ${elapsed}s!`);
          console.log('\n📊 Results:');
          console.log(`   Confidence: ${(metadata.faqMatchConfidence * 100).toFixed(1)}%`);
          console.log(`   Is FAQ: ${metadata.isFAQ ? 'YES' : 'NO'}`);

          if (metadata.faqMatchConfidence >= 0.85) {
            console.log(`   ✅ HIGH CONFIDENCE - Should auto-send`);
            if (metadata.faqTemplateId) {
              console.log(`   Template ID: ${metadata.faqTemplateId}`);
            }

            // Wait a bit for auto-response
            console.log('\n   Waiting 5s for auto-response...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            const updatedDoc = await messageRef.get();
            const updatedMetadata = updatedDoc.data().metadata;

            if (updatedMetadata.autoResponseId) {
              console.log(`   ✅ Auto-response sent! Response ID: ${updatedMetadata.autoResponseId}`);

              // Verify the auto-response message exists
              const autoResponseDoc = await db.collection('conversations')
                .doc(conversationId)
                .collection('messages')
                .doc(updatedMetadata.autoResponseId)
                .get();

              if (autoResponseDoc.exists) {
                const autoResponse = autoResponseDoc.data();
                console.log(`   ✅ Auto-response verified!`);
                console.log(`   Sender: ${autoResponse.senderId}`);
                console.log(`   Text: "${autoResponse.text.substring(0, 80)}${autoResponse.text.length > 80 ? '...' : ''}"`);
              }
            } else {
              console.log(`   ⚠️  Auto-response not sent yet (check faqAutoResponse function)`);
            }
          } else if (metadata.faqMatchConfidence >= 0.70) {
            console.log(`   💡 MEDIUM CONFIDENCE - Should show suggestion button`);
            if (metadata.suggestedFAQ) {
              console.log(`   ✅ Suggested FAQ stored!`);
              console.log(`   Question: "${metadata.suggestedFAQ.question}"`);
              console.log(`   Answer: "${metadata.suggestedFAQ.answer?.substring(0, 60)}..."`);
              console.log('\n   The user should see "💡 Suggested FAQ" button in the app!');
            }
          } else {
            console.log(`   ℹ️  LOW CONFIDENCE - No action needed`);
          }
        }
      } else {
        process.stdout.write('.');
      }
    }

    if (!detected) {
      console.log('\n\n⏱️  Timeout: FAQ detection did not complete');
      console.log('\n❌ Check logs:');
      console.log('   firebase functions:log --only onMessageCreatedDetectFAQ --limit 20');
      console.log('   vercel logs --since 5m');
    }

    // Clean up test message
    console.log('\n5️⃣  Cleaning up test message...');
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

testWithFAQUser();
