const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkPendingResponses() {
  const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

  console.log('Checking pending responses for user:', userId);
  console.log('');

  // Get all conversations for this user
  const conversations = await db
    .collection('conversations')
    .where('participantIds', 'array-contains', userId)
    .get();

  let totalPending = 0;
  let totalFAQs = 0;
  let totalVoiceMatched = 0;
  let totalAutoSent = 0;

  for (const convDoc of conversations.docs) {
    const messages = await db
      .collection('conversations')
      .doc(convDoc.id)
      .collection('messages')
      .get();

    const pendingMessages = messages.docs.filter(
      doc => doc.data().metadata?.pendingReview === true
    );

    const autoSentMessages = messages.docs.filter(
      doc => doc.data().metadata?.autoResponseSent === true
    );

    if (pendingMessages.length > 0 || autoSentMessages.length > 0) {
      const convData = convDoc.data();
      console.log(`\n📬 Conversation: ${convData.groupName || 'Direct message'}`);
      console.log(`   ID: ${convDoc.id}`);
      console.log(`   Pending: ${pendingMessages.length}, Auto-sent: ${autoSentMessages.length}`);

      pendingMessages.forEach(msgDoc => {
        const msg = msgDoc.data();
        const timestamp = msg.timestamp?.toDate?.() || 'N/A';

        console.log(`\n   ⏳ PENDING REVIEW - Message ID: ${msgDoc.id}`);
        console.log(`      From: ${msg.senderId}`);
        console.log(`      Time: ${timestamp}`);
        console.log(`      Text: "${msg.text.substring(0, 80)}..."`);

        if (msg.metadata?.isFAQ) {
          console.log(`      Type: FAQ`);
          console.log(`      Template ID: ${msg.metadata.faqTemplateId}`);
          if (msg.metadata.suggestedResponse) {
            console.log(`      📝 Suggested Response: "${msg.metadata.suggestedResponse.substring(0, 100)}..."`);
          }
          totalFAQs++;
        }

        if (msg.metadata?.needsVoiceResponse) {
          console.log(`      Type: Needs Voice-Matched Response`);
          totalVoiceMatched++;
        }

        totalPending++;
      });

      autoSentMessages.forEach(msgDoc => {
        const msg = msgDoc.data();
        console.log(`\n   ✅ AUTO-SENT - Original Message ID: ${msgDoc.id}`);
        console.log(`      Text: "${msg.text.substring(0, 80)}..."`);
        totalAutoSent++;
      });
    }
  }

  console.log('\n\n📊 SUMMARY:');
  console.log(`   Total pending review: ${totalPending}`);
  console.log(`   - FAQs with suggested responses: ${totalFAQs}`);
  console.log(`   - Needs voice-matched responses: ${totalVoiceMatched}`);
  console.log(`   Total auto-sent: ${totalAutoSent}`);
}

checkPendingResponses()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
