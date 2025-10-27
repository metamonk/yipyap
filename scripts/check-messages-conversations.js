/**
 * Check which conversation IDs the test messages have
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

async function checkMessagesConversations() {
  console.log('🔍 Checking message conversation IDs...\n');

  try {
    // Get all conversations for this user
    const conversationsSnap = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userId)
      .get();

    console.log(`Found ${conversationsSnap.size} conversations for user\n`);

    const conversationIds = conversationsSnap.docs.map(doc => doc.id);
    console.log('Conversation IDs:');
    conversationIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));

    // Now test the workflow fetch method
    console.log('\n\n=== TESTING WORKFLOW FETCH METHOD ===');

    // Fetch unprocessed messages
    const messagesQuerySnapshot = await db
      .collectionGroup('messages')
      .where('recipientId', '==', userId)
      .where('metadata.processed', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    console.log(`\nFound ${messagesQuerySnapshot.size} unprocessed messages`);

    const conversationIdSet = new Set();
    const messageDetails = [];

    messagesQuerySnapshot.docs.forEach(doc => {
      const data = doc.data();
      conversationIdSet.add(data.conversationId);
      messageDetails.push({
        id: doc.id,
        conversationId: data.conversationId,
        senderId: data.senderId,
        text: data.text?.substring(0, 50)
      });
    });

    console.log('\nMessage details:');
    messageDetails.forEach((msg, i) => {
      console.log(`  ${i + 1}. ID: ${msg.id}`);
      console.log(`     ConvID: ${msg.conversationId}`);
      console.log(`     Sender: ${msg.senderId}`);
      console.log(`     Text: ${msg.text}...`);
    });

    const uniqueConversationIds = Array.from(conversationIdSet);
    console.log(`\n\nUnique conversation IDs from messages:`);
    uniqueConversationIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
    console.log(`\nTotal: ${uniqueConversationIds.length}`);

    // Try to fetch these conversations the same way the workflow does
    console.log('\n=== FETCHING CONVERSATIONS (workflow method) ===');

    if (uniqueConversationIds.length === 0) {
      console.log('No conversation IDs to fetch!');
      return;
    }

    const conversationRefs = uniqueConversationIds.map(id =>
      db.collection('conversations').doc(id)
    );

    console.log(`\nFetching ${conversationRefs.length} conversations using db.getAll()...`);
    const conversationSnapshots = await db.getAll(...conversationRefs);

    console.log(`Got ${conversationSnapshots.length} snapshots\n`);
    conversationSnapshots.forEach((snap, i) => {
      console.log(`  ${i + 1}. ID: ${snap.id}`);
      console.log(`     Exists: ${snap.exists}`);
      if (snap.exists) {
        const data = snap.data();
        console.log(`     Participants: ${data.participantIds?.join(', ')}`);
        console.log(`     Archived By: ${data.archivedBy?.join(', ') || '(none)'}`);
        console.log(`     Muted By: ${data.mutedBy?.join(', ') || '(none)'}`);
      } else {
        console.log(`     ⚠️  CONVERSATION DOES NOT EXIST!`);
      }
      console.log('');
    });

    // Summary
    const existCount = conversationSnapshots.filter(s => s.exists).length;
    const missingCount = conversationSnapshots.length - existCount;

    console.log('=== SUMMARY ===');
    console.log(`Total conversations to fetch: ${conversationSnapshots.length}`);
    console.log(`Exist: ${existCount}`);
    console.log(`Missing: ${missingCount}`);

    if (missingCount > 0) {
      console.log('\n⚠️  PROBLEM: Some conversations referenced by messages do not exist!');
      console.log('This explains why the workflow gets 0 conversation contexts.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkMessagesConversations()
  .then(() => {
    console.log('\n\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
