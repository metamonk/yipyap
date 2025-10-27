/**
 * Check if test conversations have lastMessageTimestamp field
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

// Test conversation IDs
const testConvIds = [
  'conv_1761499215052_gl7jve1ut',
  'conv_1761499215677_ph7zwlqqf',
  'conv_1761499216049_yj2t8m9kw',
  'conv_1761499216436_80u1efbdv',
  'conv_1761499216823_zqtga9knp',
  'conv_1761499217180_kccz0a4sy',
];

async function checkConversationTimestamps() {
  console.log('🔍 Checking conversation timestamps...\n');

  const now = admin.firestore.Timestamp.now();
  const oneHourAgo = new admin.firestore.Timestamp(
    now.seconds - 60 * 60,
    now.nanoseconds
  );

  console.log(`Current time: ${now.toDate()}`);
  console.log(`One hour ago: ${oneHourAgo.toDate()}`);
  console.log('');

  try {
    for (const convId of testConvIds) {
      const convRef = db.collection('conversations').doc(convId);
      const convSnap = await convRef.get();

      if (!convSnap.exists) {
        console.log(`❌ ${convId}: DOES NOT EXIST`);
        continue;
      }

      const convData = convSnap.data();

      console.log(`\n=== ${convId} ===`);
      console.log(`Has lastMessageTimestamp: ${!!convData.lastMessageTimestamp}`);

      if (convData.lastMessageTimestamp) {
        const timestamp = convData.lastMessageTimestamp;
        const timestampDate = timestamp.toDate();
        const isRecent = timestamp.seconds > oneHourAgo.seconds;

        console.log(`  Value: ${timestampDate}`);
        console.log(`  Seconds: ${timestamp.seconds}`);
        console.log(`  Is recent (< 1 hour): ${isRecent}`);
        console.log(`  Would be SKIPPED: ${isRecent}`);
        console.log(`  Would be PROCESSED: ${!isRecent}`);
      } else {
        console.log(`  ⚠️  MISSING lastMessageTimestamp field!`);
        console.log(`  Would be PROCESSED: true (no timestamp check)`);
      }

      console.log(`Has lastMessage object: ${!!convData.lastMessage}`);
      if (convData.lastMessage) {
        console.log(`  lastMessage.timestamp: ${convData.lastMessage.timestamp?._seconds || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkConversationTimestamps()
  .then(() => {
    console.log('\n\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
