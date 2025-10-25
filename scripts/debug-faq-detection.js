/**
 * Debug script for FAQ detection system
 *
 * Run with: GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json node scripts/debug-faq-detection.js <messageId>
 *
 * This script checks:
 * 1. If the message exists
 * 2. If FAQ detection metadata is present
 * 3. What the confidence score was
 * 4. If it should have triggered auto-response or suggestion
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

async function debugMessage(messageId) {
  console.log('🔍 FAQ Detection Debugger\n');
  console.log('='.repeat(60));

  if (!messageId) {
    console.log('\n❌ Error: Please provide a message ID');
    console.log('Usage: node scripts/debug-faq-detection.js <messageId>\n');

    // Show recent messages
    console.log('Recent messages (last 10):');
    const messages = await db.collectionGroup('messages')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    messages.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n${idx + 1}. Message ID: ${doc.id}`);
      console.log(`   Text: ${data.text?.substring(0, 60)}...`);
      console.log(`   Sender: ${data.senderId}`);
      console.log(`   Has FAQ metadata: ${data.metadata?.faqMatchConfidence !== undefined ? 'YES' : 'NO'}`);
    });

    process.exit(1);
  }

  try {
    // Search for message in all conversations
    console.log(`\nSearching for message: ${messageId}\n`);

    const messagesQuery = await db.collectionGroup('messages')
      .where(admin.firestore.FieldPath.documentId(), '==', messageId)
      .limit(1)
      .get();

    if (messagesQuery.empty) {
      console.log('❌ Message not found!\n');
      process.exit(1);
    }

    const messageDoc = messagesQuery.docs[0];
    const message = messageDoc.data();
    const conversationId = messageDoc.ref.parent.parent.id;

    console.log('✅ Message found!\n');
    console.log('📋 Basic Info:');
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Conversation ID: ${conversationId}`);
    console.log(`   Text: "${message.text}"`);
    console.log(`   Sender: ${message.senderId}`);
    console.log(`   Timestamp: ${message.timestamp?.toDate()}`);

    // Get conversation details
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    const conversation = conversationDoc.data();

    console.log('\n💬 Conversation Info:');
    console.log(`   Type: ${conversation.type}`);
    console.log(`   Participants: ${conversation.participantIds.join(', ')}`);
    if (conversation.creatorId) {
      console.log(`   Creator: ${conversation.creatorId}`);
    }

    // Determine expected creator for FAQ detection
    let expectedCreatorId;
    if (conversation.type === 'group') {
      expectedCreatorId = conversation.creatorId;
    } else {
      expectedCreatorId = conversation.participantIds.find(id => id !== message.senderId);
    }

    console.log(`   Expected FAQ Creator: ${expectedCreatorId}`);

    // Check FAQ metadata
    console.log('\n🤖 FAQ Detection Status:');

    const metadata = message.metadata || {};

    if (metadata.faqMatchConfidence === undefined) {
      console.log('   ❌ NO FAQ DETECTION RAN!');
      console.log('\n   Possible reasons:');
      console.log('   1. Cloud Function "onMessageCreatedDetectFAQ" not triggered');
      console.log('   2. Edge Function /api/detect-faq failed');
      console.log('   3. Creator has no active FAQ templates');
      console.log('\n   Check Cloud Function logs:');
      console.log(`   firebase functions:log --only onMessageCreatedDetectFAQ --limit 50`);
    } else {
      console.log('   ✅ FAQ detection ran!');
      console.log(`   Confidence: ${(metadata.faqMatchConfidence * 100).toFixed(1)}%`);
      console.log(`   Is FAQ: ${metadata.isFAQ ? 'YES' : 'NO'}`);

      if (metadata.faqMatchConfidence >= 0.85) {
        console.log(`   Category: HIGH CONFIDENCE (≥85%) - Should AUTO-SEND`);
        if (metadata.faqTemplateId) {
          console.log(`   FAQ Template ID: ${metadata.faqTemplateId}`);
        }
        if (metadata.autoResponseSent) {
          console.log(`   ✅ Auto-response WAS sent!`);
          console.log(`   Auto-response ID: ${metadata.autoResponseId}`);
        } else {
          console.log(`   ⚠️  Auto-response NOT sent (check faqAutoResponse function)`);
        }
      } else if (metadata.faqMatchConfidence >= 0.70) {
        console.log(`   Category: MEDIUM CONFIDENCE (70-84%) - Should SUGGEST`);
        if (metadata.suggestedFAQ) {
          console.log(`   ✅ Suggested FAQ stored!`);
          console.log(`   Question: "${metadata.suggestedFAQ.question}"`);
          console.log(`   Answer: "${metadata.suggestedFAQ.answer?.substring(0, 60)}..."`);
          console.log(`   Template ID: ${metadata.suggestedFAQ.templateId}`);
          console.log('\n   💡 User should see "Suggested FAQ" button in UI');
        } else {
          console.log(`   ⚠️  No suggested FAQ stored (check Edge Function response)`);
        }
      } else {
        console.log(`   Category: LOW CONFIDENCE (<70%) - No action needed`);
      }
    }

    // Check if creator has any FAQs
    console.log('\n📚 Creator FAQ Templates:');
    if (expectedCreatorId) {
      const faqTemplates = await db.collection('faq_templates')
        .where('creatorId', '==', expectedCreatorId)
        .where('isActive', '==', true)
        .get();

      console.log(`   Total active FAQs: ${faqTemplates.size}`);

      if (faqTemplates.size > 0) {
        console.log('\n   Questions:');
        faqTemplates.docs.forEach((doc, idx) => {
          const faq = doc.data();
          console.log(`   ${idx + 1}. "${faq.question}" (ID: ${doc.id})`);
        });
      } else {
        console.log('   ⚠️  No active FAQ templates found for this creator!');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Debug complete!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get message ID from command line argument
const messageId = process.argv[2];
debugMessage(messageId);
