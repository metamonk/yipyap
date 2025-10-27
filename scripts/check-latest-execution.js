/**
 * Check latest execution details and logs
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

async function checkExecution() {
  const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';
  const executionId = 'exec_1761496015489_XoBenqsIt7bRp9ZYsftif0ZQc9o1';

  console.log('Checking execution logs...\n');

  // Check if there are agent logs
  const logsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('agent_logs')
    .where('executionId', '==', executionId)
    .limit(30)
    .get();

  if (logsSnapshot.empty) {
    console.log('No agent logs found for this execution');
  } else {
    console.log(`Found ${logsSnapshot.size} log entries:\n`);
    logsSnapshot.docs.forEach((doc, i) => {
      const logData = doc.data();
      console.log(`${i + 1}. ${logData.message}`);
    });
  }

  // Check if digest was created
  console.log('\n---\nChecking for digest...\n');
  const digestsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('meaningful10_digests')
    .where('executionId', '==', executionId)
    .limit(1)
    .get();

  if (digestsSnapshot.empty) {
    console.log('❌ NO DIGEST found for this execution');
  } else {
    console.log('✅ Digest found!');
  }
}

checkExecution()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
