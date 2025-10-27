/**
 * Check if Meaningful 10 digest exists in Firestore
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

async function checkDigest() {
  const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

  console.log('Checking for meaningful10_digests...\n');

  // Query all digests for this user
  const digestsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('meaningful10_digests')
    .orderBy('date', 'desc')
    .limit(5)
    .get();

  if (digestsSnapshot.empty) {
    console.log('❌ NO DIGESTS FOUND');
    console.log('\nExpected location: /users/' + userId + '/meaningful10_digests');
    return;
  }

  console.log(`✅ Found ${digestsSnapshot.size} digest(s):\n`);

  digestsSnapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`Digest ${index + 1}:`);
    console.log(`  Document ID: ${doc.id}`);
    console.log(`  Date: ${data.date?.toDate?.() || data.date}`);
    console.log(`  Generated At: ${data.generatedAt?.toDate?.() || data.generatedAt}`);
    console.log(`  Execution ID: ${data.executionId}`);
    console.log(`  High Priority: ${data.highPriority?.length || 0} messages`);
    console.log(`  Medium Priority: ${data.mediumPriority?.length || 0} messages`);
    console.log(`  Auto-Handled: ${JSON.stringify(data.autoHandled)}`);
    console.log(`  Capacity Used: ${data.capacityUsed}`);
    console.log(`  Time Commitment: ${data.estimatedTimeCommitment} min`);
    console.log('');
  });
}

checkDigest()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
