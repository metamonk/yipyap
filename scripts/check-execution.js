/**
 * Check execution details and logs
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
  const executionId = 'exec_1761495669124_XoBenqsIt7bRp9ZYsftif0ZQc9o1';

  console.log('Checking execution details...\n');

  // Get execution document
  const execDoc = await db
    .collection('users')
    .doc(userId)
    .collection('daily_executions')
    .doc(executionId)
    .get();

  if (!execDoc.exists) {
    console.log('❌ Execution document not found');
    return;
  }

  const execData = execDoc.data();
  console.log('✅ Execution document found:\n');
  console.log(JSON.stringify(execData, null, 2));

  // Check if there are agent logs
  console.log('\n---\nChecking agent logs...\n');
  const logsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('agent_logs')
    .where('executionId', '==', executionId)
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  if (logsSnapshot.empty) {
    console.log('No agent logs found for this execution');
  } else {
    console.log(`Found ${logsSnapshot.size} log entries:\n`);
    logsSnapshot.docs.forEach((doc, i) => {
      const logData = doc.data();
      console.log(`Log ${i + 1}:`);
      console.log(`  Step: ${logData.step}`);
      console.log(`  Status: ${logData.status}`);
      console.log(`  Message: ${logData.message}`);
      console.log('');
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
    digestsSnapshot.docs.forEach(doc => {
      console.log(`  Document ID: ${doc.id}`);
      console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
    });
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
