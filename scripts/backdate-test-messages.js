/**
 * Backdate test messages to be older than 1 hour
 * This allows them to be picked up by the daily agent workflow
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

async function backdateMessages() {
  console.log('🕒 Backdating test messages to be >1 hour old...\n');

  try {
    const now = admin.firestore.Timestamp.now();
    // Set timestamps to 2 hours ago to safely pass the 1-hour threshold
    const twoHoursAgo = new admin.firestore.Timestamp(
      now.seconds - 2 * 60 * 60,
      now.nanoseconds
    );

    console.log(`Current time: ${now.toDate().toISOString()}`);
    console.log(`Backdating to: ${twoHoursAgo.toDate().toISOString()}`);
    console.log('');

    // Find all conversations for this user
    const conversationsSnap = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userId)
      .get();

    console.log(`Found ${conversationsSnap.size} conversations to backdate\n`);

    let totalMessagesUpdated = 0;
    let totalConversationsUpdated = 0;

    for (const convDoc of conversationsSnap.docs) {
      console.log(`Processing conversation: ${convDoc.id}`);

      // Get all messages in this conversation
      const messagesSnap = await db
        .collection('conversations')
        .doc(convDoc.id)
        .collection('messages')
        .get();

      if (messagesSnap.empty) {
        console.log('  No messages found, skipping');
        continue;
      }

      console.log(`  Found ${messagesSnap.size} messages`);

      // Update all messages
      const messageBatch = db.batch();
      messagesSnap.docs.forEach((msgDoc) => {
        messageBatch.update(msgDoc.ref, {
          timestamp: twoHoursAgo,
          createdAt: twoHoursAgo,
        });
      });

      await messageBatch.commit();
      totalMessagesUpdated += messagesSnap.size;

      // Update conversation's lastMessageTimestamp
      const lastMessage = messagesSnap.docs[0].data();
      await convDoc.ref.update({
        lastMessageTimestamp: twoHoursAgo,
        'lastMessage.timestamp': twoHoursAgo,
        updatedAt: twoHoursAgo,
      });

      totalConversationsUpdated++;
      console.log(`  ✅ Updated ${messagesSnap.size} messages and conversation timestamp\n`);
    }

    console.log('✅ Backdating complete!\n');
    console.log('Summary:');
    console.log(`  - Conversations updated: ${totalConversationsUpdated}`);
    console.log(`  - Messages updated: ${totalMessagesUpdated}`);
    console.log(`  - New timestamp: ${twoHoursAgo.toDate().toISOString()}`);
    console.log('\nMessages are now >1 hour old and will be picked up by the daily agent workflow!');
  } catch (error) {
    console.error('❌ Error backdating messages:', error);
    throw error;
  }
}

backdateMessages()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
