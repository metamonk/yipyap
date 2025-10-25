const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkExecution() {
  const exec = await db
    .collection('users')
    .doc('XoBenqsIt7bRp9ZYsftif0ZQc9o1')
    .collection('daily_executions')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (exec.empty) {
    console.log('No executions found');
    return;
  }

  const data = exec.docs[0].data();
  console.log('Latest Execution:');
  console.log('  ID:', exec.docs[0].id);
  console.log('  Status:', data.status);
  console.log('  Digest Summary:', data.digestSummary || 'N/A');
  console.log('  Results:', JSON.stringify(data.results, null, 4));

  if (data.steps && data.steps.length > 0) {
    console.log('\nWorkflow Steps:');
    data.steps.forEach(step => {
      console.log(`  [${step.step}] ${step.status}: ${step.message}`);
    });
  } else {
    console.log('\nNo step logs found');
  }

  console.log('\nMetrics:', JSON.stringify(data.metrics, null, 4));
}

checkExecution().then(() => process.exit(0));
