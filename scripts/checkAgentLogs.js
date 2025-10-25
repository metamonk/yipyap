const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkAgentLogs() {
  // Check agent logs for the test user
  const logs = await db
    .collection('users')
    .doc('XoBenqsIt7bRp9ZYsftif0ZQc9o1')
    .collection('agent_logs')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  console.log(`Found ${logs.size} agent logs\n`);

  if (logs.empty) {
    console.log('No agent logs found');
    return;
  }

  logs.docs.forEach((doc, i) => {
    const data = doc.data();
    const timestamp = data.timestamp ? data.timestamp.toDate().toISOString() : 'N/A';
    console.log(`Log ${i + 1}:`);
    console.log(`  ExecutionID: ${data.executionId || 'N/A'}`);
    console.log(`  Timestamp: ${timestamp}`);
    console.log(`  Level: ${data.level}`);
    console.log(`  Message: ${data.message}`);
    console.log(`  Step: ${data.metadata?.step || 'N/A'}`);
    console.log(`  Status: ${data.metadata?.status || 'N/A'}`);
    console.log('');
  });
}

checkAgentLogs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
