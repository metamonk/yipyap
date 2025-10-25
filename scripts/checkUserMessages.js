/**
 * Quick script to check how many messages a user has sent
 * Usage: node scripts/checkUserMessages.js <userId>
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'yipyap-444',
  });
}

const db = admin.firestore();

async function checkUserMessages() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Usage: node scripts/checkUserMessages.js <userId>');
    process.exit(1);
  }

  console.log(`\n🔍 Checking messages for user: ${userId}\n`);

  try {
    // Query all messages sent by this user (same query as voice training)
    const messagesSnapshot = await db
      .collectionGroup('messages')
      .where('senderId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();

    console.log(`📊 Total messages found: ${messagesSnapshot.size}\n`);

    if (messagesSnapshot.size > 0) {
      console.log('Recent messages:');
      messagesSnapshot.docs.slice(0, 5).forEach((doc, index) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || 'No timestamp';
        const text = data.text?.substring(0, 50) || 'No text';
        const conversationId = data.conversationId || 'Unknown';

        console.log(`\n${index + 1}. Message ID: ${doc.id}`);
        console.log(`   Conversation: ${conversationId}`);
        console.log(`   Timestamp: ${timestamp}`);
        console.log(`   Text: ${text}${data.text?.length > 50 ? '...' : ''}`);
      });

      console.log(`\n✅ User has ${messagesSnapshot.size} messages`);
      console.log(`✅ Voice training should work!`);
    } else {
      console.log('⚠️  No messages found for this user');
      console.log('\nPossible reasons:');
      console.log('1. User ID is incorrect');
      console.log('2. Messages were deleted');
      console.log('3. Wrong Firebase project');
      console.log('4. Messages exist but senderId field is different');
    }

    // Also check voice profile
    console.log('\n📋 Checking voice profile...');
    const voiceProfileDoc = await db.collection('voice_profiles').doc(userId).get();

    if (voiceProfileDoc.exists) {
      const profile = voiceProfileDoc.data();
      console.log(`✅ Voice profile exists`);
      console.log(`   Training samples: ${profile?.trainingSampleCount || 0}`);
      console.log(`   Last trained: ${profile?.lastTrainedAt?.toDate?.() || 'Never'}`);
    } else {
      console.log('❌ No voice profile found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkUserMessages();
