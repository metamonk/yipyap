/**
 * Manually check test conversation and its messages
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

// Pick one of the test conversations
const testConvId = 'conv_1761499215052_gl7jve1ut';

async function checkTestConversation() {
  console.log('🔍 Checking test conversation...\n');
  console.log(`Conversation ID: ${testConvId}\n`);

  try {
    // Get the conversation
    const convRef = db.collection('conversations').doc(testConvId);
    const convSnap = await convRef.get();

    console.log('=== CONVERSATION ===');
    console.log(`Exists: ${convSnap.exists}`);

    if (convSnap.exists) {
      const convData = convSnap.data();
      console.log(`Participants: ${convData.participantIds?.join(', ')}`);
      console.log(`Archived By: ${JSON.stringify(convData.archivedBy) || '(none)'}`);
      console.log(`Muted By: ${JSON.stringify(convData.mutedBy) || '(none)'}`);
      console.log(`Last Message: ${JSON.stringify(convData.lastMessage)}`);
    } else {
      console.log('⚠️  CONVERSATION DOES NOT EXIST!');
      return;
    }

    // Get ALL messages in this conversation
    console.log('\n=== ALL MESSAGES ===');
    const allMessagesSnap = await convRef.collection('messages').get();
    console.log(`Total messages: ${allMessagesSnap.size}`);

    allMessagesSnap.docs.forEach((msgDoc, i) => {
      const msgData = msgDoc.data();
      console.log(`\n${i + 1}. Message ID: ${msgDoc.id}`);
      console.log(`   Conversation ID: ${msgData.conversationId}`);
      console.log(`   Sender ID: ${msgData.senderId}`);
      console.log(`   Recipient ID: ${msgData.recipientId}`);
      console.log(`   Text: ${msgData.text?.substring(0, 50)}...`);
      console.log(`   Timestamp: ${msgData.timestamp?.toDate?.()}`);
      console.log(`   Metadata processed: ${msgData.metadata?.processed}`);
      console.log(`   Metadata relationshipScore: ${msgData.metadata?.relationshipScore}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTestConversation()
  .then(() => {
    console.log('\n\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
